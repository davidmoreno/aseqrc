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

hidden_in = ["Timer", "Announce"]
hidden_out = ["Timer", "Announce"]


def list_ports(type, hidden):
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
            label = m.groups()[1].strip()
            if label in hidden:
                continue
            port_id = m.groups()[0]
            ret.append({
                "id": "%s:%s" % (parent_id, port_id),
                "label": label
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


@app.route("/sw.js", methods=["GET"])
def swjs():
    with open("sw.js", 'rb') as fd:
        content = fd.read()
    return flask.Response(content, mimetype="application/javascript")


@app.route("/manifest.json", methods=["GET"])
def manifestjson():
    with open("manifest.json", 'rb') as fd:
        content = fd.read()
    return flask.Response(content, mimetype="application/json")


@app.route("/icons/<path:path>", methods=["GET"])
def icons(path):
    print(f"icons/{path}")
    with open(f"icons/{path}", 'rb') as fd:
        content = fd.read()
    return flask.Response(content, mimetype="image/png")

@app.route("/index.html", methods=["GET", "POST"])
def index_html():
    return index()

@app.route("/", methods=["GET", "POST"])
def index():
    global hidden_in, hidden_out
    errors = []
    if flask.request.method == "POST":
        data = flask.request.form
        if 'hide_in' in data:
            hidden_in.append(data["hide_in"])
        elif 'hide_out' in data:
            hidden_out.append(data["hide_out"])
        elif 'show_in' in data:
            hidden_in = [x for x in hidden_in if x != data["show_in"]]
        elif 'show_out' in data:
            hidden_out = [x for x in hidden_out if x != data["show_out"]]
        elif 'conn' in data:
            try:
                if 'on' not in data:
                    sh.aconnect("-d", *data["conn"].split())
                elif 'on' in data:
                    sh.aconnect(*data["conn"].split())
            except sh.ErrorReturnCode as e:
                errors = ["Could not connect/disconnect", str(e)]
        return flask.redirect("/")

    input_ports = list_ports(PORT_INPUT, hidden_in)
    output_ports = list_ports(PORT_OUTPUT, hidden_out)

    connections = list_connections()

    return flask.render_template(
        "index.html",
        inputs=input_ports,
        outputs=output_ports,
        connections=connections,
        errors=errors,
        hidden_in=hidden_in,
        hidden_out=hidden_out,
    )


if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0")
