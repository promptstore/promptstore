-- Table: public.file_uploads

\connect promptstore

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
    CONSTRAINT file_uploads_pkey PRIMARY KEY (id)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.file_uploads
    OWNER TO promptstoreadmin;

ALTER SEQUENCE public.file_uploads_id_seq
    OWNER to promptstoreadmin;

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
    OWNER TO promptstoreadmin;

ALTER SEQUENCE public.users_id_seq
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."workspaces_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."apps_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."prompt_sets_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."settings_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."functions_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."models_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."training_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."compositions_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."chat_sessions_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."doc_indexes_id_seq"
    OWNER to promptstoreadmin;

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
    OWNER to promptstoreadmin;

ALTER SEQUENCE public."data_sources_id_seq"
    OWNER to promptstoreadmin;

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
