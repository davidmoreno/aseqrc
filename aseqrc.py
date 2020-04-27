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
import hashlib
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)-8s:%(message)s',)
logger = logging.getLogger("aseqrc")
# import alsaseq

PATH = os.path.realpath(os.path.dirname(__file__))
if PATH == '/usr/share/aseqrc/':
    CONFIGFILE = '/var/lib/aseqrc/current.json'
else:
    CONFIGFILE = os.path.expanduser(
        "~/.config/aseqrc/current.json"
    )

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
                "hidden_in": ["System / Timer", "System / Announce"],
                "hidden_out": ["System / Timer", "System / Announce"],
                "name_to_port": {}
            }

    def get(self, key, defval=None):
        return self.config.get(key, defval)

    def __getitem__(self, name):
        return self.config[name]

    def __setitem__(self, name, value):
        if self.config.get(name) == value:  # NOP
            return value
        self.config[name] = value
        with open(self.filename, 'wt') as fd:
            fd.write(json.dumps(self.config, indent=2))
        return value


config = Config(CONFIGFILE)


def list_ports(type, hidden):
    if type == PORT_INPUT:
        flags = "-li"
    elif type == PORT_OUTPUT:
        flags = "-lo"
    else:
        flags = "-l"

    name_to_port = config["name_to_port"]
    ret = []
    parent_id = 0
    parent_name = ""
    for line in sh.aconnect(flags):
        m = RE_PARENT.match(line)
        if m:
            parent_id = m.group(1)
            parent_name = m.group(2)
        m = RE_CHILD.match(line)
        if m:
            label = m.group(2).strip()
            label = f"{parent_name} / {label}"
            if label in hidden:
                continue
            port_id = m.group(1)
            port = f"{parent_id}:{port_id}"
            ret.append({
                "port": port,
                "label": label,
                "id": label,
            })
            name_to_port[label] = port
    return ret


def list_connections():
    ret = {}
    frms = []
    parent_id = 0
    parent_name = ""
    port_id = 0
    port_to_name = {}
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
            if name in config["hidden_in"]:
                continue
            ret[name] = frms
            port = f"{parent_id}:{port_id}"
            port_to_name[port] = name
        m = RE_CONNECT_TO.match(line)
        if m:
            for idx in range(0, len(m.groups()), 3):
                # print(line, m.groups())
                if not m.groups()[idx]:
                    continue
                port = "%s:%s" % (m.groups()[idx], m.groups()[idx + 1])
                frms.append(port)

    ret = {
        k: [port_to_name.get(port) for port in v]
        for k, v in
        ret.items()
    }
    print(ret)
    config["connections"] = ret

    return ret


@app.route("/connect", methods=["POST", "OPTIONS"])
def connect_api():
    if flask.request.method != "POST":
        resp = flask.jsonify({"detail": "Nothing to do"})
        resp.headers["Access-Control-Allow-Headers"] = 'Content-Type'
        resp.headers["Access-Control-Allow-Origin"] = HOSTNAME
        return resp

    from_ = flask.request.json["from"]
    to_ = flask.request.json["to"]

    errors = connect(from_, to_)
    if errors:
        resp = flask.jsonify({"detail": "Done"})
    else:
        resp = flask.jsonify({"detail": errors})
    resp.headers["Access-Control-Allow-Headers"] = 'Content-Type'
    resp.headers["Access-Control-Allow-Origin"] = HOSTNAME
    return resp


def connect(from_, to_):
    errors = None
    logger.info("Connect <%s> to <%s>", from_, to_)
    name_to_port = config["name_to_port"]
    if from_ not in name_to_port:
        logger.debug("Unknown port name: %s", from_)
        errors = ["Unknown port name", str(from_)]
    if to_ not in name_to_port:
        logger.debug("Unknown port name: %s", to_)
        errors = ["Unknown port name", str(to_)]

    if errors:
        return errors

    try:
        sh.aconnect(name_to_port[from_], name_to_port[to_])
    except sh.ErrorReturnCode as e:
        errors = ["Could not connect", str(e)]

    return errors


@app.route("/disconnect", methods=["POST", "OPTIONS"])
def disconnect_api():
    if flask.request.method != "POST":
        resp = flask.jsonify({"detail": "Nothing to do"})
        resp.headers["Access-Control-Allow-Headers"] = 'Content-Type'
        resp.headers["Access-Control-Allow-Origin"] = HOSTNAME
        return resp

    from_ = flask.request.json["from"]
    to_ = flask.request.json["to"]

    errors = disconnect(from_, to_)
    if errors:
        resp = flask.jsonify({"detail": "Done"})
    else:
        resp = flask.jsonify({"detail": errors})
    resp.headers["Access-Control-Allow-Headers"] = 'Content-Type'
    resp.headers["Access-Control-Allow-Origin"] = HOSTNAME
    return resp


def disconnect(from_, to_):
    logger.info("Disconnect <%s> to <%s>", from_, to_)
    name_to_port = config["name_to_port"]
    errors = None
    if not from_ in name_to_port:
        logger.debug("Unknonw port name: %s", from_)
        errors = ["Unknown port name", str(from_)]
    if not to_ in name_to_port:
        logger.debug("Unknonw port name: %s", to_)
        errors = ["Unknown port name", str(to_)]
    try:
        sh.aconnect("-d", name_to_port[from_], name_to_port[to_])
    except sh.ErrorReturnCode as e:
        errors = ["Could not disconnect", str(e)]

    return errors


@app.route("/sw.js", methods=["GET"])
def swjs():
    return flask.redirect("/static/sw.js")


@app.route("/manifest.json", methods=["GET"])
def manifestjson():
    return flask.redirect("/static/manifest.json")


@app.route("/index.html", methods=["GET", "POST"])
def index_html():
    return flask.redirect("/static/index.html")


@app.route("/", methods=["GET", "POST"])
def index():
    return flask.redirect("/static/index.html")


@app.route("/favicon.ico", methods=["GET", "POST"])
def favicon():
    return flask.redirect("/static/icons/icon-128x128.png")


@app.route("/status", methods=["GET", "POST"])
def status():
    print(config)
    input_ports = list_ports(PORT_INPUT, config["hidden_in"])
    output_ports = list_ports(PORT_OUTPUT, config["hidden_out"])

    connections = list_connections()

    resp = flask.jsonify({
        "inputs": input_ports,
        "outputs": output_ports,
        "connections": connections,
        "hidden_in": config["hidden_in"],
        "hidden_out": config["hidden_out"],
    })
    resp.headers["Access-Control-Allow-Origin"] = HOSTNAME
    return resp


def setup():
    ports = list_ports(PORT_ALL, [])

    for from_, tos_ in config.get("connections", {}).items():
        for to_ in tos_:
            if from_ and to_:
                connect(from_, to_)


if __name__ == '__main__':
    setup()
    app.run(debug=True, host="0.0.0.0")
