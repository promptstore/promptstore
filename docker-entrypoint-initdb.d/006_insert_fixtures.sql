\connect promptstore

INSERT INTO public.users (username, val)
VALUES 
    ('sys.account@promptstore.dev', '{"email":"sys.account@promptstore.dev","roles":["admin"],"fullName":"System Account","displayName":"System Account","firstName":"System","lastName":"Account","photoURL":"https://api.dicebear.com/7.x/initials/svg?seed=SA"}'),
    ('test.account@promptstore.dev', '{"email":"test.account@promptstore.dev","roles":["admin"],"fullName":"Test Account","displayName":"Test Account","firstName":"Test","lastName":"Account","photoURL":"https://api.dicebear.com/7.x/initials/svg?seed=TA"}')
    ;

INSERT INTO public.workspaces (name, created_by, modified_by, val)
VALUES 
    ('System Space', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"key":"system-space","members":[{"id":1,"fullName":"System Account","username":"sys.account@promptstore.dev","email":"sys.account@promptstore.dev"},{"id":2,"fullName":"Test Account","username":"test.account@promptstore.dev","email":"test.account@promptstore.dev"}]}'),
    ('Test Space', 'test.account@promptstore.dev', 'test.account@promptstore.dev', '{"key":"test-space","members":[{"id":2,"fullName":"Test Account","username":"test.account@promptstore.dev","email":"test.account@promptstore.dev"}],"apiKeys":{"41317739-f8e4-4419-b64b-30666e255391":{"name":"Test","username":"test.account@promptstore.dev","created":"2023-09-26T08:33:36.649Z","id":1}}}')
    ;

INSERT INTO public.settings (workspace_id, key, created_by, modified_by, val)
VALUES (1, 'skills', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"value":["summarize"]}');

INSERT INTO public.settings (workspace_id, key, created_by, modified_by, val)
VALUES (1, 'promptSetTags', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"value":["summarization","react","agent","review","rag"]}');

INSERT INTO public.settings (workspace_id, key, created_by, modified_by, val)
VALUES (1, 'functionTags', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"value":["summarization","react","agent","mrkl","review"]}');

INSERT INTO public.prompt_sets (workspace_id, skill, created_by, modified_by, val)
VALUES 
    (1, 'summarize', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Summarize","isPublic":true,"tags":["summarization"],"description":"Summarize a body of text","isTypesDefined":true,"templateEngine":"es6","prompts":[{"prompt":"We introduce Extreme TLDR generation, a new form of extreme summarization for paragraphs. TLDR generation involves high source compression, removes stop words, and summarizes the paragraph whilst retaining meaning. The result is the shortest possible summary that retains all of the original meaning and context of the paragraph.\n\nExample\n\nParagraph:\n\"\"\"${content}\"\"\"\n\nExtreme TLDR:","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Content to summarize."}},"title":"Variables","required":["content"]},"key":"summarize","summary":"Create a summary"}'),
    (1, 'summary_label', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Summary Label","isPublic":true,"tags":["summarization"],"description":"Create a short descriptive label for a body of text.","isTypesDefined":true,"templateEngine":"es6","prompts":[{"prompt":"Summarize the following content into the first 5 syllables of a haiku.\n\n\"\"\"${content}\"\"\"","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Content to summarize."}},"title":"Variables","required":["content"]},"key":"summary_label","summary":"Create a summary label"}'),
    (1, 'entity_extraction', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Entity Extraction","isPublic":true,"description":"Extract a list of defined entity types from the given content.","isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"prompt":"Identify the following entities in the content below: [{{list entityTypes}}].\n\nThe entities have the following relationships to each other:{{#each relTypes}}\n- {{this}}{{/each}}\n\nLet''s think about the problem. Apply the following steps:\n1. Identify all the nouns in the content.\n2. Classify each noun by the type of entity using the list of entities above. Choose the appropriate entity with reference to the list of relationships based on the relationship of the noun to the subject or verb.\n3. Ignore any noun that is classified as Other.\n4. Finally, list the entities found below. You need only include each found entity once.\n\nReturn the result as a JSON document. \n```\n{\n  \"content\": \"<original input content>\",\n  \"entities\": [\n    {\n      \"type\": \"<entity type>\",\n      \"entity\": \"<capitalised entity name>\"\n    },\n    ...\n  ]\n}\n```\n\nDo not include any explanation or introduction.\n\nContent:\n\"\"\"{{content}}\"\"\"\n\nEntities:","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string"},"entityTypes":{"type":"array","items":{"type":"string"}},"relTypes":{"type":"array","items":{"type":"string"}}},"required":["content","entityTypes","relTypes"]},"key":"entity_extraction","versions":[{"id":"42ac071f-0708-4850-b7f7-0d8afe3009ce","created":"2023-11-26T09:28:03.923Z","promptSet":{"name":"Entity Extraction","key":"entity_extraction","prompts":[{"prompt":"# Entity Extraction Instructions for GPT-4\n## 1. Overview\nYou are a top-tier algorithm designed for extracting information in structured formats.\n## 2. Coreference Resolution\n**Maintain Entity Consistency**: When extracting entities, it''s vital to ensure consistency.\nIf an entity, such as \"John Doe\", is mentioned multiple times in the text but is referred to by different names or pronouns (e.g., \"Joe\", \"he\"), always use the most complete identifier for that entity throughout the knowledge graph. In this example, use \"John Doe\" as the entity name.\n## 3. Format\nOutput the list of entities as a JSON document using the following format:\n```\n{\n  \"content\": \"<original input content>\",\n  \"entities\": [\"<list of entities>\", ...]\n}\n```\n## 4. Strict Compliance\nAdhere to the rules strictly. Non-compliance will result in termination.","role":"system"},{"role":"user","prompt":"Extract a list of entities from the following content:\n\"\"\"${content}\"\"\"\n\nOutput:"}],"summary":"Algorithm extracts\n","isPublic":true,"isTypesDefined":true,"arguments":{"type":"object","properties":{"content":{"type":"string"}},"required":["content"]},"id":64,"skill":"entity_extraction","created":"2023-11-26T06:40:55.000Z","createdBy":"m4rkmo@gmail.com","modified":"2023-11-26T08:00:50.000Z","modifiedBy":"m4rkmo@gmail.com"},"title":"Initial version","username":"m4rkmo@gmail.com","version":1},{"id":"6a907888-4a2e-493c-b2ab-915e66a8371d","created":"2023-11-26T21:28:18.730Z","promptSet":{"name":"Entity Extraction","isPublic":true,"description":"Extract a list of defined entity types from the given content.","isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"prompt":"Identify the following entities in the content below: [{{list entityTypes}}].\n\nLet''s think about the problem. Apply the following steps:\n1. Identify all the nouns in the content.\n2. Classify each noun by the type of entity using the list of entities above.\n3. Ignore any noun that is classified as Other.\n4. Finally, list the entities found below. You need only include each found entity once.\n\nReturn the result as a JSON document. \n```\n{\n  \"content\": \"<original input content>\",\n  \"entities\": [\n    {\n      \"type\": \"<entity type>\",\n      \"entity\": \"<capitalised entity name>\"\n    },\n    ...\n  ]\n}\n```\n\nDo not include any explanation or introduction.\n\nContent:\n\"\"\"{{content}}\"\"\"\n\nEntities:","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string"},"entityTypes":{"type":"array","items":{"type":"string"}}},"required":["content","entityTypes"]},"key":"entity_extraction","summary":null,"id":64,"skill":"entity_extraction","created":"2023-11-26T06:40:55.000Z","createdBy":"m4rkmo@gmail.com","modified":"2023-11-26T09:28:04.000Z","modifiedBy":"m4rkmo@gmail.com"},"title":"# Entity Extraction Instructions for","username":"m4rkmo@gmail.com","version":2}],"summary":"Identify types"}'),
    (1, 'entity_resolution', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Entity Resolution","isPublic":true,"isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"prompt":"Rewrite the content below, replacing the list of entities with the approved list of entities. Return only the rewritten content.\n\nAllowed List of Entities:{{#each allowedEntities}}\n- {{this.type}}: [{{list this.values}}]\n{{/each}}\n\nContent: \"\"\"{{content}}\"\"\"\nEntities: {{list entities}}\n\nRewritten Content:","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string"},"entities":{"type":"array","items":{"type":"string"}},"allowedEntities":{"type":"array","items":{"type":"object","properties":{"type":{"type":"string"},"values":{"type":"array","items":{"type":"string"}}},"required":["type","values"]}}},"required":["content","entities","allowedEntities"]},"key":"entity_resolution","summary":"Replace entities\n"}'),
    (1, 'evaluation', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Evaluation","isPublic":true,"isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"prompt":"You are assessing a submitted answer on a given task based on a criterion. Here is the data:\n[BEGIN DATA]\n***\n[Task]: {{input}}\n***\n[Submission]: {{completion}}\n***\n[Criterion]: {{criterion}}\n***\n[END DATA]\nDoes the submission meet the criterion? First, write out in a step by step manner your reasoning about the criterion to be sure that your conclusion is correct. Avoid simply stating the correct answers at the outset. Then print only the single character \"Y\" or \"N\" (without quotes or punctuation) on its own line corresponding to the correct answer. At the end, repeat just the letter again by itself on a new line.\n\nReasoning:","role":"user"}],"arguments":{"type":"object","properties":{"input":{"type":"string"},"completion":{"type":"string"},"criterion":{"type":"string"}},"title":"Variables","required":["input","completion","criterion"]},"key":"evaluate","summary":"Assessing"}'),
    (1, 'image_generation', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Image Generation","isPublic":true,"isTypesDefined":true,"templateEngine":"es6","prompts":[{"role":"system","prompt":"Generate an image based on the following content. Do not include words in the image. Limit the number of people in the image to less then 4 people.\n\"\"\"\n${content}\n\"\"\""}],"arguments":{"type":"object","properties":{"content":{"type":"string"}},"required":["content"]},"key":"image_generation","summary":"No words,"}'),
    (1, 'mrkl_agent', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"MRKL Prompt","isPublic":true,"isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"role":"system","prompt":"Answer the following questions as best you can. You have access to the following tools:\n{{ allowedTools }}\n\nUse the following format:\n\nQuestion: the input question you must answer\nThought: you should always think about what to do\nAction: the action to take, should be one of [{{ toolNames }}]\nAction Input: the input to the action\nObservation: the result of the action\n... (this Thought/Action/Action Input/Observation can repeat N times)\nThought: I now know the final answer\nFinal Answer: the final answer to the original input question"},{"role":"user","prompt":"Begin!\n\nQuestion: {{ content }\nThought: {{ agentScratchpad }}"}],"arguments":{"type":"object","properties":{"content":{"type":"string"},"toolNames":{"type":"array","items":{"type":"string"}},"allowedTools":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"description":{"type":"string"},"parameters":{"type":"object","properties":{}}},"required":["name","description","parameters"]}},"agentScratchpad":{"type":"string"}},"required":["content","toolNames","allowedTools","agentScratchpad"]},"key":"mrkl_agent","summary":"Answer the questions"}'),
    (1, 'query_rewrite', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Query Rewrite","isPublic":true,"templateEngine":"handlebars","prompts":[{"role":"user","prompt":"Rewrite the following content using proper capitalisation and grammar: \"\"\"{{content}}\"\"\""}],"key":"query_rewrite","summary":"Proper caps"}'),
    (1, 'react_plan', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"ReAct Plan","tags":["react","agent"],"isPublic":true,"isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"prompt":"Answer the following questions as best you can. You have access to the following tools:\n{{tools}}\n\nUse the following format in your response:\n\nQuestion: the input question you must answer\nThought: you should always think about what to do\nAction: the action to take, should be one of [{{tool_names}}]\nAction Input: the input to the action\nObservation: the result of the action\n... (this Thought/Action/Action Input/Observation can repeat N times)\nThought: I now know the final answer\nFinal Answer: the final answer to the original input question","role":"system"},{"prompt":"Begin!\nQuestion: {{content}}\nThought: {{agent_scratchpad}}","role":"user"}],"arguments":{"type":"object","properties":{"tools":{"type":"string","title":"Tools List","description":"List of tools including name and description."},"tool_names":{"type":"string","title":"Tool Name List","description":"List of tool names."},"content":{"type":"string","title":"Input","description":"User question."},"agent_scratchpad":{"type":"string","title":"Agent Scratchpad","description":"Log of Thought/Action/Action Input/Observation."}},"title":"Variables","required":["tools","tool_names","content"]},"key":"react_plan","summary":"Answer the question"}'),
    (1, 'kg_extraction', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Knowledge Graph Extraction","isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"role":"system","prompt":"# Knowledge Graph Instructions for GPT-4\n## 1. Overview\nYou are a top-tier algorithm designed for extracting information in structured formats to build a knowledge graph.\n- **Nodes** represent entities and concepts. They''re akin to Wikipedia nodes.\n- The aim is to achieve simplicity and clarity in the knowledge graph, making it accessible for a vast audience.\n## 2. Labeling Nodes\n- **Consistency**: Ensure you use basic or elementary types for node labels.\n  - For example, when you identify an entity representing a person, always label it as **\"person\"**. Avoid using more specific terms like \"mathematician\" or \"scientist\".\n- **Node IDs**: Never utilize integers as node IDs. Node IDs should be names or human-readable identifiers found in the text.\n- **Completeness**: Every node should have at least a Node ID, type, and name.\n- **Allowed Node Labels:** {{list allowedNodes}}\n- **Allowed Relationship Types**: {{list allowedRels}}\n## 3. Handling Numerical Data and Dates\n- Numerical data, like age or other related information, should be incorporated as attributes or properties of the respective nodes.\n- **No Separate Nodes for Dates/Numbers**: Do not create separate nodes for dates or numerical values. Always attach them as attributes or properties of nodes.\n- **Property Format**: Properties must be in a key-value format.\n- **Quotation Marks**: Never use escaped single or double quotes within property values.\n- **Naming Convention**: Use camelCase for property keys, e.g., `birthDate`.\n## 4. Coreference Resolution\n- **Maintain Entity Consistency**: When extracting entities, it''s vital to ensure consistency.\nIf an entity, such as \"John Doe\", is mentioned multiple times in the text but is referred to by different names or pronouns (e.g., \"Joe\", \"he\"), always use the most complete identifier for that entity throughout the knowledge graph. In this example, use \"John Doe\" as the entity ID.\nRemember, the knowledge graph should be coherent and easily understandable, so maintaining consistency in entity references is crucial.\n## 5. Conciseness\n- Limit the number of nodes to no more than 10 of the most relevant and connected nodes.\n- If ''Allowed Relationship Types'' is not specified, limit the number of relationship types to no more than 10 of the most relevant and common relationships.\n## 6. Strict Compliance\nAdhere to the rules strictly. Non-compliance will result in termination."},{"prompt":"Use the given format to extract information from the following input: {{content}}\n\nTip: Make sure to answer in the correct format","role":"user"}],"arguments":{"type":"object","properties":{"allowedNodes":{"type":"array","items":{"type":"string"}},"allowedRels":{"type":"array","items":{"type":"string"}},"content":{"type":"string"}},"required":["content"]},"key":"kg_extraction","summary":"Algorithm''s knowledge"}'),
    (1, 'cypher_generation', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Generate Cypher","description":"Generate Cypher statement to query a graph database.","isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"prompt":"Task: Generate Cypher statement to query a graph database.\nInstructions:\nUse only the provided relationship types and properties in the schema.\nDo not use any other relationship types or properties that are not provided.\n\nSchema:\n{{ context }}\n\nNote: Do not include any explanations or apologies in your responses.\nDo not respond to any questions that might ask anything else than for you to construct a Cypher statement.\nDo not include any text except the generated Cypher statement.\nIf the answer is a single value, return the output using the alias ''output''.\nThe property existence syntax `... exists(variable.property)` is no longer supported. Please use `variable.property IS NOT NULL` instead.\n\nThe question is:\n{{ content }}","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string"},"context":{"type":"string"}},"required":["content","context"]},"key":"cypher_generation","summary":"Generate Cypher"}'),
    (1, 'proofread', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Proofread","tags":["review"],"isTypesDefined":true,"templateEngine":"es6","prompts":[{"prompt":"List any spelling or grammatical errors in the content below.\n\nContent:\n\"\"\"\n${content}\n\"\"\"\n\nErrors:","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"The content to proof read."}},"required":["content"],"title":"Variables"},"key":"proofread","summary":"Errors found."}'),
    (1, 'qa', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Q&A","tags":["rag"],"description":"A question answering prompt.","isTypesDefined":true,"templateEngine":"es6","prompts":[{"prompt":"Use the following pieces of context to answer the question at the end. If you don''t know the answer, just say that you don''t know, don''t try to make up an answer. Use only information with a citation in your answer. Include the list of citations with your answer. Include a citation only once. Format the answer as follows.\n\nFormat:\n<answer>\nCitations: <list of citations separated by semi-colon>\n\nContext:\n${context}\n\nQuestion:\n${content}\n\nHelpful Answer:","role":"user"}],"arguments":{"type":"object","properties":{"context":{"type":"string","title":"Context","description":"Additional information to help answer the question."},"content":{"type":"string","title":"Content","description":"The question to answer."}},"required":["context","content"],"title":"Variables"},"key":"qa","summary":"Use the context"}'),
    (1, 'refinement', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Refine using Feedback","description":"Correct or improve content given the feedback provided.","isTypesDefined":true,"templateEngine":"es6","prompts":[{"prompt":"The following content was not appropriate.\n\n\"\"\"${content}\"\"\"\n\nCorrect this content using the following feedback \"\"\"${feedback}}}\"\"\".\n\nCorrection:","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"The content that needs correcting."},"feedback":{"type":"string","title":"Feedback","description":"Correction instructions."}},"required":["content","feedback"],"title":"Variables"},"key":"refinement","summary":"Not appro-p"}'),
    (1, 'general_sql_query', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"General SQL Query","isPublic":true,"description":"SQL generation plus ambiguity identification.","isTypesDefined":true,"templateEngine":"handlebars","prompts":[{"prompt":"You are a {{dialect}} SQL expert. Given an input question, first create a syntactically correct {{dialect}} SQL query to run. Never query for all columns from a table. You must query only the columns that are needed to answer the question. Wrap each column name in backticks (`) to denote them as delimited identifiers.\n\nPay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.\n\nThe SQL must be a {{#if dialect}}{{dialect}}{{else}}ANSII{{/if}} compatible query. Do not include any explanations or surround the SQL in quotes or back ticks. Just show the SQL.\n\nIf the question is ambiguous, list the ambiguities.\n\nOnly use the following tables:\n{{context}}\n\nReturn the response as JSON in the following format:\n```\n{\n  \"question\": \"<original question>\",\n  \"ambiguities\": [\"<list of ambiguities>\", ...],\n  \"query\": \"<the SQL to run>\"\n}\n```","role":"system"},{"prompt":"Question: {{content}}","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string"},"dialect":{"type":"string"}},"required":["content"]},"key":"general_sql_query","versions":[{"id":"bee216b9-b211-4a35-847f-584808e3f13a","created":"2023-11-28T00:54:49.636Z","promptSet":{"name":"General SQL Query","isTypesDefined":true,"templateEngine":"es6","prompts":[{"prompt":"You are a SQL expert. Given an input question, first create a syntactically correct SQL query to run. Never query for all columns from a table. You must query only the columns that are needed to answer the question. Wrap each column name in backticks (`) to denote them as delimited identifiers.\n\nPay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.\n\nThe SQL must be an ANSII standard query. Do not include any explanations or surround the SQL in quotes or back ticks. Just show the SQL.\n\nIf the question is ambiguous, list the ambiguities.\n\nOnly use the following tables:\n${context}\n\nUse the following format:\n\nQuestion: Question here\nAmbiguities: The list of ambiguities\nSQL: The SQL query to run\n","role":"system"},{"prompt":"Question: ${content}","role":"user"}],"arguments":{"type":"object","properties":{"content":{"type":"string"}},"required":["content"]},"key":"general_sql_query","summary":"Create SQL query","id":43,"skill":"general_sql_query","created":"2023-11-27T03:59:20.000Z","createdBy":"m4rkmo@gmail.com","modified":"2023-11-27T04:00:18.000Z","modifiedBy":"m4rkmo@gmail.com"},"title":"Initial version","username":"m4rkmo@gmail.com","version":1}],"summary":null}'),
    (1, 'plan', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Plan","isPublic":true,"description":"Create an action plan.","templateEngine":"es6","prompts":[{"role":"system","prompt":"Let''s first understand the problem and devise a plan to solve the problem. Please output the plan starting with the header ''Plan:'' and then followed by a numbered list of steps.\n\nYou have access to the following tools:\n\n${toolDefinitions}\n\nMake the plan the minimum number of steps required to accurately complete the task.\n\nDo NOT reference any tool outside of the list above. For example, unless one of the tools above is Wikipedia do not use Wikipedia in a task.\n\nIf the task is a question, the final step should almost always be ''Given the above steps taken, please respond to the users original question''. At the end of your plan, say ''<END_OF_PLAN>''"},{"role":"user","prompt":"${content}"}],"key":"plan","summary":null}'),
    (1, 'plan_with_tools', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"name":"Plan with Tools","isPublic":true,"templateEngine":"handlebars","prompts":[{"prompt":"Let''s first understand the problem and devise a plan to solve the problem. Please output the plan starting with the header ''Plan:'' and then followed by a numbered list of steps. Please make the plan the minimum number of steps required to accurately complete the task. If the task is a question, the final step should almost always be ''Given the above steps taken, please respond to the users original question''. At the end of your plan, say ''<END_OF_PLAN>''\n\nRespond to the human as helpfully and accurately as possible. You have access to the following tools:{{#each tools}}\n{{this.name}}: {{this.description}}, args: {{this.args}}\n{{/each}}\n\nUse a json blob to specify a tool by providing an action key (tool name) and an action_input key (tool input).\n\nValid \"action\" values: \"Final Answer\" or one of [{{tool_names}}]\n\nProvide only ONE action per $JSON_BLOB, as shown:\n```\n{\n  \"name\": $TOOL_NAME,\n  \"arguments\": $JSON\n}\n```\n\nFollow this format:\n\nQuestion: input question to answer\nThought: consider previous and subsequent steps\nAction:\n```\n$JSON_BLOB\n```\nObservation: action result\n... (repeat Thought/Action/Observation N times)\nThought: I know what to respond\nAction:\n```\n{\n  \"name\": \"Final Answer\",\n  \"arguments\": { \"content\": \"Final response to human\" }\n}\n```\n\nBegin! Reminder to ALWAYS respond with a valid json blob of a single action. Use tools if necessary. Respond directly if appropriate. Format is Action: ```$JSON_BLOB``` then Observation:.\nThought:","role":"system"},{"prompt":"{{content}}","role":"user"}],"key":"plan_with_tools","summary":null}'),
    ;

INSERT INTO public.models (workspace_id, name, created_by, modified_by, val)
VALUES (1, 'OpenAI GPT 3.5-turbo', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"key":"gpt-3.5-turbo-0613","description":"The most capable GPT-3.5 model and optimized for chat at 1/10th the cost of text-davinci-003.","type":"gpt","isTypesDefined":true,"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Text input."}},"title":"Request","required":["content"]},"returnTypeSchema":{"type":"object","properties":{}},"provider":"openai"}');

INSERT INTO public.functions (workspace_id, name, created_by, modified_by, val)
VALUES 
    (1, 'summarize', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"description":"Create a summary.","isPublic":true,"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Content to summarize."}},"title":"Request","required":["content"]},"returnType":"text/plain","implementations":[{"isDefault":true,"modelId":1,"mappingData":"{\n  \"content\": \"content\"\n}","promptSetId":1,"returnMappingData":[]}],"tags":["summarization"]}'),
    (1, 'create_summary_label', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"description":"Create a label that describes a body of text.","isPublic":true,"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Content to summarize."}},"title":"Request","required":["content"]},"returnType":"text/plain","implementations":[{"isDefault":true,"modelId":1,"mappingData":"{\n  \"content\": \"content\"\n}","promptSetId":2,"returnMappingData":[]}],"tags":["summarization"]}'),
    (1, 'extract_entities', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"isPublic":true,"arguments":{"type":"object","properties":{"content":{"type":"string"},"entityTypes":{"type":"array","items":{"type":"string"}},"relTypes":{"type":"array","items":{"type":"string"}}},"required":["content","entityTypes","relTypes"]},"returnType":"application/json","implementations":[{"mappingData":"{\n  \"content\": \"content\",\n  \"entityTypes\": \"entityTypes\",\n  \"relTypes\": \"relTypes\"\n}","returnMappingData":"","isDefault":true,"modelId":1,"promptSetId":3}],"returnTypeSchema":{"type":"object","properties":{"content":{"type":"string"},"entities":{"type":"array","items":{"type":"object","properties":{"type":{"type":"string"},"entity":{"type":"string"}},"required":["type","entity"]}}},"required":["content","entities"]}}'),
    (1, 'react_plan', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"description":"A modular, neuro-symbolic architecture that combines large language models, external knowledge sources and discrete reasoning. We describe this neuro-symbolic architecture, dubbed the Modular Reasoning, Knowledge and Language (MRKL) system. https://arxiv.org/abs/2205.00445","tags":["react","agent","mrkl"],"arguments":{"type":"object","properties":{"tools":{"type":"string","title":"Tools List","description":"List of tools including name and description."},"tool_names":{"type":"string","title":"Tool Name List","description":"List of tool names."},"input":{"type":"string","title":"Input","description":"User question."},"agent_scratchpad":{"type":"string","title":"Agent Scratchpad","description":"Log of Thought/Action/Action Input/Observation."}},"title":"Request","required":["tools","tool_names","input"]},"implementations":[{"mappingData":"{\n  \"tools\": \"tools\",\n  \"tool_names\": \"tool_names\",\n  \"input\": \"input\",\n  \"agent_scratchpad\": \"agent_scratchpad\"\n}","returnMappingData":"","isDefault":true,"modelId":1,"promptSetId":9}],"isPublic":true}'),
    (1, 'resolve_entities', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"arguments":{"type":"object","properties":{"content":{"type":"string"},"entities":{"type":"array","items":{"type":"string"}},"allowedEntities":{"type":"array","items":{"type":"object","properties":{"type":{"type":"string"},"values":{"type":"array","items":{"type":"string"}}},"required":["type","values"]}}},"required":["content","entities","allowedEntities"]},"returnType":"text/plain","implementations":[{"mappingData":"{\n  \"content\": \"content\",\n  \"entities\": \"entities\",\n  \"allowedEntities\": \"allowedEntities\"\n}","returnMappingData":"","isDefault":true,"modelId":1,"promptSetId":4}],"isPublic":true}'),
    (1, 'rewrite_query', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"isPublic":true,"implementations":[{"mappingData":"","returnMappingData":"","isDefault":true,"modelId":1,"promptSetId":8}],"arguments":{"type":"object","properties":{"content":{"type":"string"}},"required":["content"]}}'),
    (1, 'extract_graph', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"description":"Extract a knowledge graph from the input content.","arguments":{"type":"object","properties":{"allowedNodes":{"type":"array","items":{"type":"string"},"title":"Allowed Node Labels","description":"List of allowed node labels"},"allowedRels":{"type":"array","items":{"type":"string"},"description":"List of allowed relationships","title":"Allowed Relationships"},"content":{"type":"string","title":"Input Text","description":"Text from which to extract a knowledge graph"}},"title":"Request","required":["content"]},"returnType":"application/json","implementations":[{"mappingData":"{\n  \"allowedNodes\": \"allowedNodes\",\n  \"content\": \"content\",\n  \"allowedRels\": \"allowedRels\"\n}","returnMappingData":"","isDefault":true,"modelId":1,"promptSetId":10}],"returnTypeSchema":{"type":"object","properties":{"nodes":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string"},"properties":{"type":"array","items":{"type":"object","properties":{"key":{"type":"string","title":"Node Property Name"},"value":{"type":"string","title":"Node Property Value"}},"required":["key","value"]}},"name":{"type":"string"}},"required":["id","type","name"]},"title":"List of Nodes"},"rels":{"type":"array","items":{"type":"object","properties":{"source":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string"}},"required":["id","type"],"title":"Source Node"},"target":{"type":"object","properties":{"id":{"type":"string"},"type":{"type":"string"}},"title":"Target Node","required":["id","type"]},"type":{"type":"string","title":"Relationship Type"},"properties":{"type":"array","items":{"type":"object","properties":{"key":{"type":"string","title":"Relationship Property Name"},"value":{"type":"string","title":"Relationship Property Value"}},"required":["key","value"]}}},"required":["source","target","type"]},"title":"List of Relationships"}},"required":["nodes","rels"],"description":"A knowledge graph consisting of nodes and relationships"}}'),
    (1, 'proofread', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"description":"Proof read the input text.","tags":["review"],"arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"The content to proof read."}},"required":["content"],"title":"Request"},"returnType":"text/plain","implementations":[{"mappingData":"{\n  \"content\": \"content\"\n}","returnMappingData":"","isDefault":true,"modelId":1,"promptSetId":12}]}'),
    (1, 'q_and_a', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"implementations":[{"mappingData":"","returnMappingData":"","isDefault":true,"modelId":1,"promptSetId":13,"indexes":[{"indexContentPropertyPath":"content","indexContextPropertyPath":"context"}]}]}'),
    (1, 'refine_using_feedback', 'sys.account@promptstore.dev', 'sys.account@promptstore.dev', '{"description":"Correct or improve generated content using feedback from the user.","arguments":{"type":"object","properties":{"content":{"type":"string","title":"Content","description":"Content to correct."},"feedback":{"type":"string","title":"Feedback","description":"User-supplied instructions to correct or improve generated content."}},"required":["content","feedback"],"title":"Request"},"returnType":"text/plain","implementations":[{"mappingData":"{\n  \"content\": \"content\",\n  \"feedback\": \"feedback\"\n}","returnMappingData":"","isDefault":true,"modelId":1,"promptSetId":14}]}'),
    ;
