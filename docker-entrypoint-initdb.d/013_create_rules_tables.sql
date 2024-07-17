\connect rules_db


-- Table: public."RuleSets"

DROP TABLE IF EXISTS public."RuleSets";

-- Sequence: public."RuleSets_id_seq"

DROP SEQUENCE IF EXISTS public."RuleSets_id_seq";

CREATE SEQUENCE public."RuleSets_id_seq" AS bigint;

CREATE TABLE public."RuleSets"
(
    id integer NOT NULL DEFAULT nextval('"RuleSets_id_seq"'::regclass),
    key character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "RuleSets_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."RuleSets"
    ADD COLUMN "branch" character varying(255) NOT NULL DEFAULT '' COLLATE pg_catalog."default"
    ;

ALTER TABLE public."RuleSets"
    OWNER to rules_user;

ALTER SEQUENCE public."RuleSets_id_seq"
    OWNER to rules_user;

ALTER SEQUENCE public."RuleSets_id_seq"
    OWNED BY public."RuleSets"."id";

-- Index: rule_sets_rule_set_key_key

DROP INDEX IF EXISTS public.rule_sets_rule_set_key_key;

CREATE INDEX rule_sets_rule_set_key_key
    ON public."RuleSets" USING btree
    (key COLLATE pg_catalog."default")
    TABLESPACE pg_default;
