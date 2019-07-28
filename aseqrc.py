#!/usr/bin/python3

import flask
import sh
import re
# import alsaseq


app = flask.Flask(__name__, template_folder=".")
PORT_INPUT = 1
PORT_OUTPUT = 2
RE_PARENT = re.compile(r"client (\d+): '(.*?)' \[((.*?)=(.*?))+\]$")
RE_CHILD = re.compile(r"    (\d+) '(.*?)'$")
RE_CONNECT_TO = re.compile(r"\tConnecting To: (.*?):(.*?)(, (.*?):(.*?))*$")


def list_ports(type):
    if type == PORT_INPUT:
        flags = "-li"
    else:
        flags = "-lo"

    ret = []
    parent_id = 0
    for line in sh.aconnect(flags):
        m = RE_PARENT.match(line)
        if m:
            parent_id = m.groups()[0]
        m = RE_CHILD.match(line)
        if m:
            port_id = m.groups()[0]
            ret.append({
                "id": "%s:%s" % (parent_id, port_id),
                "label": m.groups()[1]
            })
    return ret


def list_connections():
    ret = {}
    frms = []
    parent_id = 0
    port_id = 0
    for line in sh.aconnect("-l"):
        m = RE_PARENT.match(line)
        if m:
            parent_id = m.groups(1)[0]
        m = RE_CHILD.match(line)
        if m:
            port_id = m.groups(1)[0]
            frms = []
            ret["%s:%s" % (parent_id, port_id)] = frms
        m = RE_CONNECT_TO.match(line)
        if m:
            for idx in range(0, len(m.groups()), 3):
                frms.append("%s:%s" % (m.groups()[idx], m.groups()[idx + 1]))

    return ret


@app.route("/", methods=["GET", "POST"])
def index():
    errors = []
    if flask.request.method == "POST":
        data = flask.request.form
        try:
            if 'on' not in data:
                sh.aconnect("-d", *data["conn"].split())
            else:
                sh.aconnect(*data["conn"].split())
        except sh.ErrorReturnCode as e:
            errors = ["Could not connect/disconnect", str(e)]

    input_ports = list_ports(PORT_INPUT)
    output_ports = list_ports(PORT_OUTPUT)

    connections = list_connections()

    return flask.render_template(
        "index.html",
        inputs=input_ports,
        outputs=output_ports,
        connections=connections,
        errors=errors,
    )


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0")
