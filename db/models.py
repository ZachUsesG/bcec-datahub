from sqlalchemy import Table, Column, MetaData, Text, Integer, String, ForeignKey

metadata = MetaData()


Person = Table(
    "Person",
    metadata,
    Column("Person_id", Integer, primary_key=True),
    Column("email", String(50), unique=True, nullable=False),
    Column("name", String(50)),
    Column("linkedin", String(50)),
    Column("phone", Integer),
    Column("socials", String(50)),
    Column("graduation_semester", Integer, nullable=True),

)

Membership = Table(
    "Membership",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("Person_id", Integer, ForeignKey("Person.Person_id")),
    Column("start_semester", String(5), nullable=False),
    Column("end_semester", Integer, nullable=True),
    Column("role", String(50)),
    Column("committee", String(50)),

)

ExternalProfile = Table(
    "ExternalProfile",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("Person_id", Integer, ForeignKey("Person.Person_id"), unique=True),

    Column("current_title", String(100), nullable=True),
    Column("current_company", String(100), nullable=True),

    Column("manual_title", String(100), nullable=True),
    Column("manual_company", String(100), nullable=True),
    Column("manual_updated_at", String(30), nullable=True),

    Column("data_source", String(20), nullable=False),
    Column("last_verified_at", String(10), nullable=True),
)
