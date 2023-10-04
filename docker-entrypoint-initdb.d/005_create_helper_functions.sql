\connect promptstore

CREATE OR REPLACE FUNCTION json_to_varchar_array(json) RETURNS VARCHAR[] IMMUTABLE PARALLEL SAFE LANGUAGE SQL as $$
  SELECT array_agg(x::VARCHAR) from json_array_elements($1) f(x)
$$;

CREATE OR REPLACE FUNCTION json_property_to_varchar_array(json, property text) RETURNS VARCHAR[] IMMUTABLE PARALLEL SAFE LANGUAGE SQL as $$
  SELECT array_agg((x->>$2)::VARCHAR) from json_array_elements($1) f(x)
$$;

CREATE OR REPLACE FUNCTION json_property_to_int_array(json, property text) RETURNS INT[] IMMUTABLE PARALLEL SAFE LANGUAGE SQL as $$
  SELECT array_agg((x->>$2)::INT) from json_array_elements($1) f(x)
$$;
