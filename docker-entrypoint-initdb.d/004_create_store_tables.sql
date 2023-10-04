\connect offline_store

DROP TABLE IF EXISTS public.marketing_copy;

DROP SEQUENCE IF EXISTS public.marketing_copy_id_seq;

CREATE SEQUENCE public.marketing_copy_id_seq AS bigint;

CREATE TABLE public.marketing_copy
(
    id integer NOT NULL DEFAULT nextval('marketing_copy_id_seq'::regclass),
    text TEXT COLLATE pg_catalog."default",
    campaign_id integer,
    campaign_name character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT "marketing_copy_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."marketing_copy"
    OWNER to storeadmin;

ALTER SEQUENCE public."marketing_copy_id_seq"
    OWNER to storeadmin;

ALTER SEQUENCE public."marketing_copy_id_seq"
    OWNED BY public."marketing_copy"."id";
