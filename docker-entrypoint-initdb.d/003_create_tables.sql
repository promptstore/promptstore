\connect promptstore

-- Table: public.file_uploads

DROP TABLE IF EXISTS public.file_uploads;

-- Sequence: public.file_uploads_id_seq

DROP SEQUENCE IF EXISTS public.file_uploads_id_seq;

CREATE SEQUENCE public.file_uploads_id_seq AS bigint;

CREATE TABLE public.file_uploads
(
    id integer NOT NULL DEFAULT nextval('file_uploads_id_seq'::regclass),
    workspace_id integer NOT NULL,
    user_id character varying(255) COLLATE pg_catalog."default",
    filename character varying(255) COLLATE pg_catalog."default",
    val json,
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT file_uploads_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.file_uploads
    OWNER TO psadmin;

ALTER SEQUENCE public.file_uploads_id_seq
    OWNER to psadmin;

ALTER SEQUENCE public.file_uploads_id_seq
    OWNED BY public.file_uploads."id";

-- Index: file_uploads_workspace_id_key

DROP INDEX IF EXISTS public.file_uploads_workspace_id_key;

CREATE INDEX file_uploads_workspace_id_key
    ON public.file_uploads USING btree
    (workspace_id)
    TABLESPACE pg_default;


DROP TABLE IF EXISTS public.users;

-- Sequence: public.users_id_seq

DROP SEQUENCE IF EXISTS public.users_id_seq;

CREATE SEQUENCE public.users_id_seq AS bigint;

CREATE TABLE public.users
(
    id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    username character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT users_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.users
    OWNER TO psadmin;

ALTER SEQUENCE public.users_id_seq
    OWNER to psadmin;

ALTER SEQUENCE public.users_id_seq
    OWNED BY public.users."id";

-- Index: users_user_id_key

DROP INDEX IF EXISTS public.users_username_key;

CREATE INDEX users_user_id_key
    ON public.users USING btree
    (username)
    TABLESPACE pg_default;


-- Table: public."workspaces"

DROP TABLE IF EXISTS public."workspaces";

-- Sequence: public."workspaces_id_seq"

DROP SEQUENCE IF EXISTS public."workspaces_id_seq";

CREATE SEQUENCE public."workspaces_id_seq" AS bigint;

CREATE TABLE public."workspaces"
(
    id integer NOT NULL DEFAULT nextval('"workspaces_id_seq"'::regclass),
    name character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."workspaces"
    OWNER to psadmin;

ALTER SEQUENCE public."workspaces_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."workspaces_id_seq"
    OWNED BY public."workspaces"."id";

-- Index: workspaces_name_key

DROP INDEX IF EXISTS public.workspaces_name_key;

CREATE INDEX workspaces_name_key
    ON public."workspaces" USING btree
    (name COLLATE pg_catalog."default")
    TABLESPACE pg_default;


-- Table: public."apps"

DROP TABLE IF EXISTS public."apps";

-- Sequence: public."apps_id_seq"

DROP SEQUENCE IF EXISTS public."apps_id_seq";

CREATE SEQUENCE public."apps_id_seq" AS bigint;

CREATE TABLE public."apps"
(
    id integer NOT NULL DEFAULT nextval('"apps_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "apps_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."apps"
    OWNER to psadmin;

ALTER SEQUENCE public."apps_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."apps_id_seq"
    OWNED BY public."apps"."id";

-- Index: apps_name_key

DROP INDEX IF EXISTS public.apps_name_key;

CREATE INDEX apps_name_key
    ON public."apps" USING btree
    (name COLLATE pg_catalog."default")
    TABLESPACE pg_default;

-- Index: apps_workspace_id_key

DROP INDEX IF EXISTS public.apps_workspace_id_key;

CREATE INDEX apps_workspace_id_key
    ON public."apps" USING btree
    (workspace_id)
    TABLESPACE pg_default;


-- Table: public."prompt_sets"

DROP TABLE IF EXISTS public."prompt_sets";

-- Sequence: public."prompt_sets_id_seq"

DROP SEQUENCE IF EXISTS public."prompt_sets_id_seq";

CREATE SEQUENCE public."prompt_sets_id_seq" AS bigint;

CREATE TABLE public."prompt_sets"
(
    id integer NOT NULL DEFAULT nextval('"prompt_sets_id_seq"'::regclass),
    workspace_id integer,
    skill character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "prompt_sets_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."prompt_sets"
    OWNER to psadmin;

ALTER SEQUENCE public."prompt_sets_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."prompt_sets_id_seq"
    OWNED BY public."prompt_sets"."id";

-- Index: prompt_sets_workspace_id_key

DROP INDEX IF EXISTS public.prompt_sets_workspace_id_key;

CREATE INDEX prompt_sets_workspace_id_key
    ON public."prompt_sets" USING btree
    (workspace_id)
    TABLESPACE pg_default;


-- Table: public."settings"

DROP TABLE IF EXISTS public."settings";

-- Sequence: public."settings_id_seq"

DROP SEQUENCE IF EXISTS public."settings_id_seq";

CREATE SEQUENCE public."settings_id_seq" AS bigint;

CREATE TABLE public."settings"
(
    id integer NOT NULL DEFAULT nextval('"settings_id_seq"'::regclass),
    workspace_id integer,
    key character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "settings_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."settings"
    OWNER to psadmin;

ALTER SEQUENCE public."settings_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."settings_id_seq"
    OWNED BY public."settings"."id";

-- Index: settings_workspace_id_key

DROP INDEX IF EXISTS public.settings_workspace_id_key;

CREATE INDEX settings_workspace_id_key
    ON public."settings" USING btree
    (workspace_id)
    TABLESPACE pg_default;


-- Table: public."functions"

DROP TABLE IF EXISTS public."functions";

-- Sequence: public."functions_id_seq"

DROP SEQUENCE IF EXISTS public."functions_id_seq";

CREATE SEQUENCE public."functions_id_seq" AS bigint;

CREATE TABLE public."functions"
(
    id integer NOT NULL DEFAULT nextval('"functions_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "functions_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."functions"
    OWNER to psadmin;

ALTER SEQUENCE public."functions_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."functions_id_seq"
    OWNED BY public."functions"."id";

-- Index: functions_workspace_id_key

DROP INDEX IF EXISTS public.functions_workspace_id_key;

CREATE INDEX functions_workspace_id_key
    ON public."functions" USING btree
    (workspace_id)
    TABLESPACE pg_default;


-- Table: public."models"

DROP TABLE IF EXISTS public."models";

-- Sequence: public."models_id_seq"

DROP SEQUENCE IF EXISTS public."models_id_seq";

CREATE SEQUENCE public."models_id_seq" AS bigint;

CREATE TABLE public."models"
(
    id integer NOT NULL DEFAULT nextval('"models_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    source character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "models_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."models"
    OWNER to psadmin;

ALTER SEQUENCE public."models_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."models_id_seq"
    OWNED BY public."models"."id";


-- Table: public."training"

DROP TABLE IF EXISTS public."training";

-- Sequence: public."training_id_seq"

DROP SEQUENCE IF EXISTS public."training_id_seq";

CREATE SEQUENCE public."training_id_seq" AS bigint;

CREATE TABLE public."training"
(
    id integer NOT NULL DEFAULT nextval('"training_id_seq"'::regclass),
    workspace_id integer,
    prompt text COLLATE pg_catalog."default",
    response text COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "training_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."training"
    OWNER to psadmin;

ALTER SEQUENCE public."training_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."training_id_seq"
    OWNED BY public."training"."id";

-- Index: training_workspace_id_key

DROP INDEX IF EXISTS public.training_workspace_id_key;

CREATE INDEX training_workspace_id_key
    ON public."training" USING btree
    (workspace_id)
    TABLESPACE pg_default;


-- Table: public."compositions"

DROP TABLE IF EXISTS public."compositions";

-- Sequence: public."compositions_id_seq"

DROP SEQUENCE IF EXISTS public."compositions_id_seq";

CREATE SEQUENCE public."compositions_id_seq" AS bigint;

CREATE TABLE public."compositions"
(
    id integer NOT NULL DEFAULT nextval('"compositions_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "compositions_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."compositions"
    OWNER to psadmin;

ALTER SEQUENCE public."compositions_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."compositions_id_seq"
    OWNED BY public."compositions"."id";


-- Table: public."chat_sessions"

DROP TABLE IF EXISTS public."chat_sessions";

-- Sequence: public."chat_sessions_id_seq"

DROP SEQUENCE IF EXISTS public."chat_sessions_id_seq";

CREATE SEQUENCE public."chat_sessions_id_seq" AS bigint;

CREATE TABLE public."chat_sessions"
(
    id integer NOT NULL DEFAULT nextval('"chat_sessions_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    type character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."chat_sessions"
    OWNER to psadmin;

ALTER SEQUENCE public."chat_sessions_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."chat_sessions_id_seq"
    OWNED BY public."chat_sessions"."id";


-- Table: public."doc_indexes"

DROP TABLE IF EXISTS public."doc_indexes";

-- Sequence: public."doc_indexes_id_seq"

DROP SEQUENCE IF EXISTS public."doc_indexes_id_seq";

CREATE SEQUENCE public."doc_indexes_id_seq" AS bigint;

CREATE TABLE public."doc_indexes"
(
    id integer NOT NULL DEFAULT nextval('"doc_indexes_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    engine character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "doc_indexes_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."doc_indexes"
    OWNER to psadmin;

ALTER SEQUENCE public."doc_indexes_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."doc_indexes_id_seq"
    OWNED BY public."doc_indexes"."id";

-- Index: doc_indexes_workspace_id_key

DROP INDEX IF EXISTS public.doc_indexes_workspace_id_key;

CREATE INDEX doc_indexes_workspace_id_key
    ON public."doc_indexes" USING btree
    (workspace_id)
    TABLESPACE pg_default;

-- Index: doc_indexes_name_key

DROP INDEX IF EXISTS public.doc_indexes_name_key;

CREATE INDEX doc_indexes_name_key
    ON public."doc_indexes" USING btree
    (name)
    TABLESPACE pg_default;

-- Index: doc_indexes_engine_key

DROP INDEX IF EXISTS public.doc_indexes_engine_key;

CREATE INDEX doc_indexes_engine_key
    ON public."doc_indexes" USING btree
    (engine)
    TABLESPACE pg_default;


-- Table: public."data_sources"

DROP TABLE IF EXISTS public."data_sources";

-- Sequence: public."data_sources_id_seq"

DROP SEQUENCE IF EXISTS public."data_sources_id_seq";

CREATE SEQUENCE public."data_sources_id_seq" AS bigint;

CREATE TABLE public."data_sources"
(
    id integer NOT NULL DEFAULT nextval('"data_sources_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    type character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "data_sources_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."data_sources"
    OWNER to psadmin;

ALTER SEQUENCE public."data_sources_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."data_sources_id_seq"
    OWNED BY public."data_sources"."id";

-- Index: data_sources_name_key

DROP INDEX IF EXISTS public.data_sources_name_key;

CREATE INDEX data_sources_name_key
    ON public."data_sources" USING btree
    (name)
    TABLESPACE pg_default;

-- Index: data_sources_type_key

DROP INDEX IF EXISTS public.data_sources_type_key;

CREATE INDEX data_sources_type_key
    ON public."data_sources" USING btree
    (type)
    TABLESPACE pg_default;


-- Table: public."agents"

DROP TABLE IF EXISTS public."agents";

-- Sequence: public."agents_id_seq"

DROP SEQUENCE IF EXISTS public."agents_id_seq";

CREATE SEQUENCE public."agents_id_seq" AS bigint;

CREATE TABLE public."agents"
(
    id integer NOT NULL DEFAULT nextval('"agents_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "agents_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."agents"
    OWNER to psadmin;

ALTER SEQUENCE public."agents_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."agents_id_seq"
    OWNED BY public."agents"."id";


-- Table: public."traces"

DROP TABLE IF EXISTS public."traces";

-- Sequence: public."traces_id_seq"

DROP SEQUENCE IF EXISTS public."traces_id_seq";

CREATE SEQUENCE public."traces_id_seq" AS bigint;

CREATE TABLE public."traces"
(
    id integer NOT NULL DEFAULT nextval('"traces_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "traces_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."traces"
    OWNER to psadmin;

ALTER SEQUENCE public."traces_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."traces_id_seq"
    OWNED BY public."traces"."id";


-- Table: public."transformations"

DROP TABLE IF EXISTS public."transformations";

-- Sequence: public."transformations_id_seq"

DROP SEQUENCE IF EXISTS public."transformations_id_seq";

CREATE SEQUENCE public."transformations_id_seq" AS bigint;

CREATE TABLE public."transformations"
(
    id integer NOT NULL DEFAULT nextval('"transformations_id_seq"'::regclass),
    workspace_id integer,
    data_source_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "transformations_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."transformations"
    OWNER to psadmin;

ALTER SEQUENCE public."transformations_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."transformations_id_seq"
    OWNED BY public."transformations"."id";


-- Table: public."destinations"

DROP TABLE IF EXISTS public."destinations";

-- Sequence: public."destinations_id_seq"

DROP SEQUENCE IF EXISTS public."destinations_id_seq";

CREATE SEQUENCE public."destinations_id_seq" AS bigint;

CREATE TABLE public."destinations"
(
    id integer NOT NULL DEFAULT nextval('"destinations_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    type character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "destinations_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."destinations"
    OWNER to psadmin;

ALTER SEQUENCE public."destinations_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."destinations_id_seq"
    OWNED BY public."destinations"."id";

-- Index: destinations_name_key

DROP INDEX IF EXISTS public.destinations_name_key;

CREATE INDEX destinations_name_key
    ON public."destinations" USING btree
    (name)
    TABLESPACE pg_default;

-- Index: destinations_type_key

DROP INDEX IF EXISTS public.destinations_type_key;

CREATE INDEX destinations_type_key
    ON public."destinations" USING btree
    (type)
    TABLESPACE pg_default;


-- Table: public."call_log"

DROP TABLE IF EXISTS public."call_log";

-- Sequence: public."call_log_id_seq"

DROP SEQUENCE IF EXISTS public."call_log_id_seq";

CREATE SEQUENCE public."call_log_id_seq" AS bigint;

CREATE TABLE public."call_log"
(
    id integer NOT NULL DEFAULT nextval('"call_log_id_seq"'::regclass),
    workspace_id integer,
    username character varying(255) COLLATE pg_catalog."default",
    type character varying(255) COLLATE pg_catalog."default",
    provider character varying(255) COLLATE pg_catalog."default",
    model character varying(255) COLLATE pg_catalog."default",
    function_id integer,
    function_name character varying(255) COLLATE pg_catalog."default",
    system_input json,
    output_type character varying(255) COLLATE pg_catalog."default",
    system_output json,
    system_output_text text,
    model_input json,
    model_user_input_text text,
    model_output json,
    model_output_text text,
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    image_uploaded_count integer,
    image_generated_count integer,
    video_secs integer,
    latency_ms integer,
    success boolean,
    error character varying(255) COLLATE pg_catalog."default",
    val json,
    start_date TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    end_date TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    CONSTRAINT "call_log_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."call_log"
    OWNER to psadmin;

ALTER SEQUENCE public."call_log_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."call_log_id_seq"
    OWNED BY public."call_log"."id";

-- Index: destinations_username_key

DROP INDEX IF EXISTS public.call_log_username_key;

CREATE INDEX call_log_username_key
    ON public."call_log" USING btree
    (username)
    TABLESPACE pg_default;

-- Index: destinations_model_key

DROP INDEX IF EXISTS public.call_log_model_key;

CREATE INDEX call_log_model_key
    ON public."call_log" USING btree
    (model)
    TABLESPACE pg_default;


-- Table: public."evaluations"

DROP TABLE IF EXISTS public."evaluations";

-- Sequence: public."evaluations_id_seq"

DROP SEQUENCE IF EXISTS public."evaluations_id_seq";

CREATE SEQUENCE public."evaluations_id_seq" AS bigint;

CREATE TABLE public."evaluations"
(
    id integer NOT NULL DEFAULT nextval('"evaluations_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    val json,
    CONSTRAINT "evaluations_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."evaluations"
    OWNER to psadmin;

ALTER SEQUENCE public."evaluations_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."evaluations_id_seq"
    OWNED BY public."evaluations"."id";


-- Table: public."secrets"

DROP TABLE IF EXISTS public."secrets";

-- Sequence: public."secrets_id_seq"

DROP SEQUENCE IF EXISTS public."secrets_id_seq";

CREATE SEQUENCE public."secrets_id_seq" AS bigint;

CREATE TABLE public."secrets"
(
    id integer NOT NULL DEFAULT nextval('"secrets_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    value character varying(255) COLLATE pg_catalog."default",
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT "secrets_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."secrets"
    OWNER to psadmin;

ALTER SEQUENCE public."secrets_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."secrets_id_seq"
    OWNED BY public."secrets"."id";


-- Table: public."mirrors"

DROP TABLE IF EXISTS public."mirrors";

-- Sequence: public."mirrors_id_seq"

DROP SEQUENCE IF EXISTS public."mirrors_id_seq";

CREATE SEQUENCE public."mirrors_id_seq" AS bigint;

CREATE TABLE public."mirrors"
(
    id integer NOT NULL DEFAULT nextval('"mirrors_id_seq"'::regclass),
    workspace_id integer,
    name character varying(255) COLLATE pg_catalog."default",
    val json,
    created TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    created_by character varying(255) COLLATE pg_catalog."default",
    modified TIMESTAMP(0) NOT NULL DEFAULT NOW(),
    modified_by character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT "mirrors_pkey" PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public."mirrors"
    OWNER to psadmin;

ALTER SEQUENCE public."mirrors_id_seq"
    OWNER to psadmin;

ALTER SEQUENCE public."mirrors_id_seq"
    OWNED BY public."mirrors"."id";
