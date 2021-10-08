#!/usr/bin/python3

# Alsa sequencer remote control
# Copyright (C) 2020 David Moreno <dmoreno@coralbits.com>

# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.


import flask
import sh
import re
import os
import sys
import hashlib
import json
import logging
import threading

logging.basicConfig(level=logging.INFO, format='%(levelname)-8s:%(message)s',)
logger = logging.getLogger("aseqrc")

MAX_EVENTS = 100

try:
    from pyalsa import alsaseq
    PYALSA = True
except:
    logger.warning(
        "Using SH connector. It has less functionalities and is overall of less quality")
    PYALSA = False

# import alsaseq

PATH = os.path.realpath(os.path.dirname(__file__))
if PATH == '/usr/share/aseqrc/':
    CONFIGFILE = '/var/lib/aseqrc/current.json'
else:
    CONFIGFILE = os.path.expanduser(
        "~/.config/aseqrc/current.json"
    )

DEBUG = bool(os.environ.get("DEBUG"))


def to_bool(x):
    return x in [True, "true", "yes", 1, "1", "on"]


if 'DEBUG' in os.environ:
    DEBUG = to_bool(os.environ["DEBUG"])

os.chdir(PATH)

app = flask.Flask(__name__, template_folder=PATH)
PORT_INPUT = 1
PORT_OUTPUT = 2
PORT_ALL = 3
RE_PARENT = re.compile(r"client (\d+): '(.*?)' \[((.*?)=(.*?))+\]$")
RE_CHILD = re.compile(r"    (\d+) '(.*?)'$")
RE_CONNECT_TO = re.compile(r"\tConnecting To: (.*?):(.*?)(, (.*?):(.*?))*$")
HOSTNAME = "http://localhost:5000/"


class Config:
    def __init__(self, filename):
        self.config = {}
        self.filename = filename
        if os.path.exists(filename):
            with open(filename) as fd:
                self.config = json.loads(fd.read())
        else:
            os.makedirs(os.path.dirname(CONFIGFILE), exist_ok=True)
            self.config = {
                "connections": {}
            }

    def get(self, key, defval=None):
        return self.config.get(key, defval)

    def __getitem__(self, name):
        return self.config[name]

    def __setitem__(self, name, value):
        if self.config.get(name) == value:  # NOP
            return value
        self.config[name] = value
        self.save()
        return value

    def save(self):
        with open(self.filename, 'wt') as fd:
            fd.write(json.dumps(self.config, indent=2))


config = Config(CONFIGFILE)


class AlsaSequencerBase:
    def __init__(self):
        self.lock = threading.Lock()
        self.ports = {}
        self.connections = {}  # id to id
        self.events = []

    def poll(self):
        raise NotImplemented()


class AlsaSequencerSh(AlsaSequencerBase):
    """
    Basic implementation that calls aconnect -l every time
    it needs to know info about connections.

    This is not very smart, as it is slow, and do not allow
    connection tracking (ie. reconnect devices).

    This code will disappear, but no python3-pyalsa in older ubuntu 18.04.
    """

    def __init__(self):
        super().__init__()
        self.update_all_ports()

    def poll(self):
        self.update_all_ports()

    def update_all_ports(self):
        self.ports = {}  # each port: {id, label, port, input, output}
        self.update_ports(PORT_INPUT)
        self.update_ports(PORT_OUTPUT)
        self.update_connections()

    def update_ports(self, type):
        if type == PORT_INPUT:
            flags = "-li"
        elif type == PORT_OUTPUT:
            flags = "-lo"
        else:
            flags = "-l"

        parent_id = 0
        parent_name = ""

        lines = sh.aconnect(flags)

        for line in lines:
            m = RE_PARENT.match(line)
            if m:
                parent_id = m.group(1)
                parent_name = m.group(2)
            m = RE_CHILD.match(line)
            if m:
                label = m.group(2).strip()
                label = f"{parent_name} / {label}"
                port_id = m.group(1)
                port = f"{parent_id}:{port_id}"

                data = self.ports.get(port, {
                    "port": port,
                    "id": port,
                    "input": False,
                    "output": False,
                })

                data["label"] = label
                if type == PORT_INPUT:
                    data["input"] = True
                if type == PORT_OUTPUT:
                    data["output"] = True

                self.ports[port] = data

    def update_connections(self):
        ret = {}
        frms = []
        parent_id = 0
        parent_name = ""
        port_id = 0
        cmdoutput = list(sh.aconnect("-l"))
        for line in cmdoutput:
            m = RE_PARENT.match(line)
            if m:
                parent_id = m.group(1)
                parent_name = m.group(2)
            m = RE_CHILD.match(line)
            if m:
                port_id = m.group(1)
                label = m.group(2).strip()
                frms = []
                name = f"{parent_name} / {label}"
                port = f"{parent_id}:{port_id}"
                ret[port] = frms
            m = RE_CONNECT_TO.match(line)
            if m:
                for port in line[16:].split(', '):
                    # print(line, m.groups())
                    frms.append(port.strip())

        self.connections = ret
        config["connections"] = ret

        return ret

    def connect(self, from_, to_):
        errors = None
        logger.info("Connect <%s> to <%s>", from_, to_)
        if from_ not in self.ports:
            logger.debug("Unknown port name: %s", from_)
            errors = ["Unknown port name", str(from_)]
        if to_ not in self.ports:
            logger.debug("Unknown port name: %s", to_)
            errors = ["Unknown port name", str(to_)]

        if errors:
            return errors

        try:
            sh.aconnect(self.ports[from_]["port"], self.ports[to_]["port"])
        except sh.ErrorReturnCode as e:
            errors = ["Could not connect", str(e)]

        return errors

    def disconnect(self, from_, to_):
        logger.info("Disconnect <%s> to <%s>", from_, to_)
        errors = None
        if from_ not in self.ports:
            logger.debug("Unknown port name: %s", from_)
            errors = ["Unknown port name", str(from_)]
        if to_ not in self.ports:
            logger.debug("Unknown port name: %s", to_)
            errors = ["Unknown port name", str(to_)]

        if errors:
            return errors

        try:
            sh.aconnect("-d", self.ports[from_]
                        ["port"], self.ports[to_]["port"])
        except sh.ErrorReturnCode as e:
            errors = ["Could not disconnect", str(e)]

        return errors


class AlsaSequencerPyAlsa(AlsaSequencerBase):
    """
    Smarter connector, uses ALSA API.

    It tracks connections as they are done, and new ports appear.

    The track algorithm is:
    1. If a new port appears, check if we have it in the connections list, and connect
    2. When a new connection appears, add it to the connection list
    3. When a port is disconnected, remove it from the list

    This ensure that if a device disapears, it will be reconnected as last time. It follows
    the port names, not the id, as the id can change.

    It uses threads to keep the connection list current, and connect new
    clients as required. The writer is always the same thread, the thread_poller,
    and the reader might be both.

    Because of the cpython lock we are sure reads are complete and they might
    not be wrong cases with inconsistent data.
    """

    READ_MASK = 33  # manually calculated.segfault if use consts
    WRITE_MASK = 66

    SND_SEQ_PORT_TYPE_MIDI_GENERIC = (1 << 1)
    SND_SEQ_PORT_TYPE_APPLICATION = (1 << 20)
    SND_SEQ_PORT_CAP_SUBS_WRITE = (1 << 6)
    SND_SEQ_PORT_CAP_WRITE = (1 << 1)

    SEQ_EVENT_NOTEON = alsaseq.SEQ_EVENT_NOTEON
    SEQ_EVENT_NOTEOFF = alsaseq.SEQ_EVENT_NOTEOFF
    SEQ_EVENT_NOTE = alsaseq.SEQ_EVENT_NOTE

    MONITOR_EVENTS = {
        alsaseq.SEQ_EVENT_NOTEON: "noteon",
        alsaseq.SEQ_EVENT_NOTEOFF: "noteoff",
        alsaseq.SEQ_EVENT_NOTE: "note",
        alsaseq.SEQ_EVENT_CONTROLLER: "cc",
        alsaseq.SEQ_EVENT_PITCHBEND: "pitch bend",
        alsaseq.SEQ_EVENT_PGMCHANGE: "program change",
    }

    def __init__(self):
        super().__init__()
        self.seq = alsaseq.Sequencer(
            name="default",
            clientname="aseqrc",
            # streams=alsaseq.SEQ_OPEN_DUPLEX,
            # mode=alsaseq.SEQ_BLOCK,
        )
        self.event_count = 0
        self.monitor_from = None

        self.update_all_ports()
        self.create_port()

        self.thread = threading.Thread(target=self.thread_poll)
        self.thread.start()

    def update_all_ports(self):
        clients = self.seq.connection_list()

        self.ports = {}
        self.connections = {}

        for client in clients:
            clientname, clientid, ports = client
            clientinfo = self.seq.get_client_info(clientid)
            type = clientinfo['type']
            if type == alsaseq.SEQ_USER_CLIENT:
                type = 'user'
            else:
                type = 'kernel'

            for port in ports:
                portname, portid, conns = port

                self.port_start(clientid, portid, clientname=clientname)
                port = f"{clientid}:{portid}"

                if input:
                    for conn in conns[1]:
                        dport = f"{conn[0]}:{conn[1]}"
                        if dport not in self.connections:
                            self.connections[dport] = []
                        self.connections[dport].append(port)

        # update new connections. Does not remove anything. Uses ids, not port id
        if not config.get("connections"):
            config["connections"] = {}
        for from_, tos_ in self.connections.items():
            fromid_ = self.ports[from_]["label"]
            if fromid_ not in config["connections"]:
                config["connections"][fromid_] = [
                    self.ports[to_]["label"] for to_ in tos_
                ]
            else:
                for to_ in tos_:
                    label = self.ports[to_]["label"]
                    if label not in config["connections"][fromid_]:
                        config["connections"][fromid_].append(
                            label
                        )
        config.save()

    def connect(self, from_, to_):
        logger.info("Connect %s -> %s", from_, to_)
        sender = self.seq.parse_address(from_)
        receiver = self.seq.parse_address(to_)
        try:
            self.seq.get_connect_info(sender, receiver)
            logger.warning("Already connected %s -> %s", from_, to_)
            return False
        except Exception as e:
            pass  # not exist
        try:
            self.seq.connect_ports(
                sender,
                receiver,
                0,
                0,
                0,
                0,
            )
        except Exception:
            logger.error("Could not connect ports %s -> %s", from_, to_)
            return False
        return True

    def disconnect(self, from_, to_):
        logger.info("Disconnect %s -> %s", from_, to_)
        sender = self.seq.parse_address(from_)
        receiver = self.seq.parse_address(to_)
        try:
            self.seq.get_connect_info(sender, receiver)
        except Exception as e:
            logger.warning("Not connected %s -> %s", from_, to_)
            return False
        self.seq.disconnect_ports(sender, receiver)
        return True

    def create_port(self):
        port = self.seq.create_simple_port(
            name="ann",
            type=self.SND_SEQ_PORT_TYPE_MIDI_GENERIC | self.SND_SEQ_PORT_TYPE_APPLICATION,
            caps=self.SND_SEQ_PORT_CAP_WRITE | self.SND_SEQ_PORT_CAP_SUBS_WRITE
        )
        self.port = port
        self.connect("0:1", f"{self.seq.client_id}:{port}")

        self.port_start(self.seq.client_id, port, clientname="aseqrc")

    def monitor(self, from_):
        monport = f"{self.seq.client_id}:{self.port}"
        self.events = []
        if self.monitor_from:
            self.disconnect(self.monitor_from, monport)

        self.monitor_from = from_
        if from_:
            self.connect(from_, monport)

    def poll(self):
        pass

    def get_by_name(self, name):
        return next((x for x in self.ports.values() if x["label"] == name), None)

    def check_connections(self, portname):
        for inputname, outputconns in config["connections"].items():
            for outputname in outputconns:
                if inputname == portname or outputname == portname:
                    logger.info("Check port %s, match %s || %s",
                                portname, inputname, outputname)
                    output = self.get_by_name(outputname)
                    input = self.get_by_name(inputname)
                    if not input or not output:
                        continue
                    inputport = input["port"]
                    outputport = output["port"]
                    if outputport in self.ports.get(inputport, []):
                        continue  # already connected
                    logger.info(
                        "Connect as previously known connection: %s -> %s",
                        inputport, outputport
                    )
                    self.connect(inputport, outputport)

    def thread_poll(self):
        while True:
            eventlist = self.seq.receive_events(timeout=1000, maxevents=16)
            for event in eventlist:
                type = event.type
                data = event.get_data()
                if type == alsaseq.SEQ_EVENT_PORT_START:
                    self.port_start(data["addr.client"], data["addr.port"])
                elif type == alsaseq.SEQ_EVENT_PORT_EXIT:
                    self.port_exit(data["addr.client"], data["addr.port"])
                elif type == alsaseq.SEQ_EVENT_PORT_SUBSCRIBED:
                    self.port_subscribed(
                        from_clientid=data['connect.sender.client'],
                        from_portid=data['connect.sender.port'],
                        to_clientid=data['connect.dest.client'],
                        to_portid=data['connect.dest.port'],
                    )
                elif type == alsaseq.SEQ_EVENT_PORT_UNSUBSCRIBED:
                    self.port_unsubscribed(
                        from_clientid=data['connect.sender.client'],
                        from_portid=data['connect.sender.port'],
                        to_clientid=data['connect.dest.client'],
                        to_portid=data['connect.dest.port'],
                    )
                elif type in AlsaSequencerPyAlsa.MONITOR_EVENTS:
                    jevent = {
                        "id": self.event_count,
                        "type": AlsaSequencerPyAlsa.MONITOR_EVENTS[type],
                        "data": data,
                    }
                    self.event_count += 1
                    with self.lock:
                        self.events = self.events[:MAX_EVENTS]
                        self.events.insert(0, jevent)
                else:
                    logger.info("Unknown event: %s", type)

    def port_start(self, clientid, portid, clientname=None):
        with self.lock:
            portinfo = self.seq.get_port_info(portid, clientid)

            if not clientname:
                clientinfo = self.seq.get_client_info(clientid)
                clientname = clientinfo["name"]

            logger.info("Port start %s:%s %s", clientid, portid, clientname)

            port = f"{clientid}:{portid}"
            name = f"{clientname} / {portinfo['name']}"
            input = portinfo["capability"] & self.READ_MASK
            output = portinfo["capability"] & self.WRITE_MASK

            self.ports[port] = {
                "id": port,
                "port": port,
                "label": name,
                "input": bool(input),
                "output": bool(output),
                "hidden": clientid == self.seq.client_id or clientid <= 2
            }

            self.check_connections(name)

    def port_exit(self, clientid, portid):
        with self.lock:
            logger.info("Remove port %s:%s", clientid, portid)

            port = f"{clientid}:{portid}"
            if port in self.ports:
                del self.ports[port]

            if port in self.connections:
                del self.connections[port]

            conns = {}
            for input, outputs in self.connections.items():
                if port in outputs:
                    outputs = [x for x in outputs if x != port]
                conns[input] = outputs
            self.connections = conns

    def port_subscribed(self, *, from_clientid, from_portid, to_clientid, to_portid):
        with self.lock:
            from_ = f"{from_clientid}:{from_portid}"
            to_ = f"{to_clientid}:{to_portid}"

            if from_ not in self.connections:
                self.connections[from_] = []
            if to_ not in self.connections[from_]:
                self.connections[from_].append(to_)

            from_ = self.ports[from_]["label"]
            to_ = self.ports[to_]["label"]
            if from_ not in config["connections"]:
                config["connections"][from_] = []

            if to_ not in config["connections"][from_]:
                config["connections"][from_].append(to_)
                config.save()

    def port_unsubscribed(self, *, from_clientid, from_portid, to_clientid, to_portid):
        with self.lock:
            from_ = f"{from_clientid}:{from_portid}"
            to_ = f"{to_clientid}:{to_portid}"

            if from_ not in self.connections:
                return

            self.connections[from_] = [
                x
                for x in self.connections.get(from_, [])
                if x != to_
            ]

            from_ = self.ports[from_]["label"]
            to_ = self.ports[to_]["label"]
            config["connections"][from_] = [
                x
                for x in config["connections"].get(from_, [])
                if x != to_
            ]
            config.save()


if PYALSA:
    aseq = AlsaSequencerPyAlsa()
else:
    aseq = AlsaSequencerSh()

@app.after_request
def set_access_control(response):
    response.headers["Access-Control-Allow-Headers"] = 'Content-Type'
    response.headers["Access-Control-Allow-Origin"] = HOSTNAME

    return response

@app.route("/connect", methods=["POST", "OPTIONS"])
def connect_api():
    if flask.request.method != "POST":
        resp = flask.jsonify({"detail": "Nothing to do"})
        return resp

    from_ = flask.request.json["from"]
    to_ = flask.request.json["to"]

    errors = aseq.connect(from_, to_)
    if errors:
        resp = flask.jsonify({"detail": "Done"})
    else:
        resp = flask.jsonify({"detail": errors})
    return resp


@app.route("/disconnect", methods=["POST", "OPTIONS"])
def disconnect_api():
    if flask.request.method != "POST":
        resp = flask.jsonify({"detail": "Nothing to do"})
        return resp

    from_ = flask.request.json["from"]
    to_ = flask.request.json["to"]

    errors = aseq.disconnect(from_, to_)
    if errors:
        resp = flask.jsonify({"detail": "Done"})
    else:
        resp = flask.jsonify({"detail": errors})
    return resp


@app.route("/sw.js", methods=["GET"])
def swjs():
    return flask.redirect("/static/sw.js")


@app.route("/manifest.json", methods=["GET"])
def manifestjson():
    return flask.redirect("/static/manifest.json")


@app.route("/index.html", methods=["GET"])
@app.route("/", methods=["GET"])
def index():
    return open("static/index.html", 'rt').read()


@app.route("/favicon.ico", methods=["GET"])
def favicon():
    return flask.redirect("/static/icons/icon-128x128.png")


@app.route("/status", methods=["GET"])
def status():
    aseq.poll()

    with aseq.lock:
        resp = flask.jsonify({
            "ports": aseq.ports,
            "connections": aseq.connections,
        })
    return resp


@app.route("/monitor", methods=["GET", "POST"])
def monitor():
    # aseq.poll()
    if flask.request.method == "POST":
        print(flask.request.json)
        from_ = flask.request.json["from"]
        aseq.monitor(from_)
        return flask.jsonify({"details": "OK"})

    with aseq.lock:
        resp = flask.jsonify({
            "events": aseq.events,
        })

    return resp


def test():
    aseq.update_all_ports()
    print(aseq.ports)
    print(aseq.port)
    import time
    for x in range(10):
        time.sleep(1)
        aseq.poll()


if __name__ == '__main__':
    if 'test' in sys.argv:
        test()
    else:
        app.run(debug=DEBUG, host="0.0.0.0")
