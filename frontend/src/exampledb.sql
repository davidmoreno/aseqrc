create table connections(
    from_device varchar,
    from_port varchar,
    to_device varchar,
    to_port varchar,
);

create table device(device varchar, name varchar NULL,);

create table port (
    device varchar,
    port varchar,
    name varchar NULL,
    hidden boolean NULL,
);