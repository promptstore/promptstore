-- Table: public.health_scores

\connect offline_store

DROP TABLE IF EXISTS public.health_scores;

-- Sequence: public.health_scores_id_seq

DROP SEQUENCE IF EXISTS public.health_scores_id_seq;

CREATE SEQUENCE public.health_scores_id_seq AS bigint;

CREATE TABLE public.health_scores
(
    id integer NOT NULL DEFAULT nextval('health_scores_id_seq'::regclass),
    customer_id character varying(36) COLLATE pg_catalog."default",
    run_minutes integer,
    run_complete boolean,
    grip_strength_kg numeric,
    number_push_ups integer,
    plank_seconds integer,
    body_fat_percentage numeric,
    lean_muscle_score character varying(255) COLLATE pg_catalog."default",
    bone_density_score character varying(255) COLLATE pg_catalog."default",
    average_sleep_minutes integer,
    rem_sleep_percentage numeric,
    deep_sleep_percentage numeric,
    sleep_efficiency_percentage numeric,
    weekly_alcohol_consumption_standard_glasses integer,
    blood_pressure character varying(255) COLLATE pg_catalog."default",
    event_timestamp timestamp,
    created timestamp,
    CONSTRAINT health_scores_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.health_scores
    OWNER TO storeadmin;

ALTER SEQUENCE public.health_scores_id_seq
    OWNER to storeadmin;

ALTER SEQUENCE public.health_scores_id_seq
    OWNED BY public.health_scores."id";

-- Index: health_scores_customer_event_key

DROP INDEX IF EXISTS public.health_scores_customer_event_key;

CREATE INDEX health_scores_customer_event_key
    ON public.health_scores USING btree
    (customer_id, event_timestamp)
    TABLESPACE pg_default;
