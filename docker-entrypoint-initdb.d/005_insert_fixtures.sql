\connect promptstore

INSERT INTO public.users (username, val)
VALUES ('test.account@promptstore.dev', '{"email":"test.account@promptstore.dev","roles":["admin"],"fullName":"Test Account","displayName":"Test Account","firstName":"Test","lastName":"Account","photoURL":"https://avatars.dicebear.com/api/gridy/0.5334164767352256.svg"}');

INSERT INTO public.workspaces (name, created_by, modified_by, val)
VALUES ('Test Space', 'test.account@promptstore.dev', 'test.account@promptstore.dev', '{"members":[{"id":1,"fullName":"Test Account","username":"test.account@promptstore.dev","email":"test.account@promptstore.dev"}],"apiKeys":{"41317739-f8e4-4419-b64b-30666e255391":{"name":"Test","username":"test.account@promptstore.dev","created":"2023-09-26T08:33:36.649Z","id":1}}}');

INSERT INTO public.settings (workspace_id, key, created_by, modified_by, val)
VALUES (1, 'skills', 'test.account@promptstore.dev', 'test.account@promptstore.dev', '{"value":["summarize"]}');

INSERT INTO public.settings (workspace_id, key, created_by, modified_by, val)
VALUES (1, 'promptSetTags', 'test.account@promptstore.dev', 'test.account@promptstore.dev', '{"value":["summarization"]}');

INSERT INTO public.settings (workspace_id, key, created_by, modified_by, val)
VALUES (1, 'functionTags', 'test.account@promptstore.dev', 'test.account@promptstore.dev', '{"value":["summarization"]}');

INSERT INTO public.prompt_sets (workspace_id, skill, created_by, modified_by, val)
VALUES (1, 'summarize', 'test.account@promptstore.dev', 'test.account@promptstore.dev', '{"name":"Summarize","tags":["summarization"],"description":"Summarize a body of text","isTypesDefined":true,"templateEngine":"es6","prompts":[{"prompt":"We introduce Extreme TLDR generation, a new form of extreme summarization for paragraphs. TLDR generation involves high source compression, removes stop words, and summarizes the paragraph whilst retaining meaning. The result is the shortest possible summary that retains all of the original meaning and context of the paragraph.\n\nExample\n\nParagraph:\n\"\"\"${content}\"\"\"\n\nExtreme TLDR:","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Content to summarize."}},"title":"Variables","required":["content"]},"key":"summarize","summary":"Create a summary"}');

INSERT INTO public.models (workspace_id, name, created_by, modified_by, val)
VALUES (1, 'OpenAI GPT 3.5-turbo', 'test.account@promptstore.dev', 'test.account@promptstore.dev', '{"key":"gpt-3.5-turbo","description":"The most capable GPT-3.5 model and optimized for chat at 1/10th the cost of text-davinci-003.","type":"gpt","isTypesDefined":true,"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Text input."}},"title":"Request","required":["content"]},"returnTypeSchema":{"type":"object","properties":{}},"provider":"openai"}');

INSERT INTO public.functions (workspace_id, name, created_by, modified_by, val)
VALUES (1, 'summarize', 'test.account@promptstore.dev', 'test.account@promptstore.dev', '{"description":"Create a summary.","arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Content to summarize."}},"title":"Request","required":["content"]},"returnType":"text/plain","implementations":[{"isDefault":true,"modelId":1,"mappingData":"{\n  \"content\": \"content\"\n}","promptSetId":1,"returnMappingData":[]}],"tags":["summarization"]}');
