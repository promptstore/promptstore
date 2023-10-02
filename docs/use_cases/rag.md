# Retrieval Augmented Generation

## Introduction

Retrieval Augmented Generation (RAG) is a common technique for mitigating 
the risk of hallucination - the tendency to make stuff up. Large Language
Models are "story telling machines". They will generate the most probable
completion to the starting text (prompt), even if that means that facts 
have to confabulated to do so.

In psychiatry, confabulation is to fabricate imaginary experiences as 
compensation for loss of memory. We can't entirely remove this risk - it
is the LLM's nature. To reduce the risk, we enhance the model's memory
when the request is made by injecting relevant knowledge into the prompt.

This technique is known as Retrieval Augmented Generation, or RAG for short.

The essential flow of RAG is:

1. Load a document with the relevant knowledge.
2. Index the document's contents to facilitate lookup using the text of
   the model request.
3. Populate the top results into the prompt alongside the instructions to
   fulfill the request.
4. Trust these facts will be consulted when the model generates a response.

I use "trust" because the nature of these models is there is no guarantee.
We need to validate results at various stages and re-request a new generation 
as necessary.

## Open the Prompt Store UI

If you haven't already setup the Prompt Store, follow the 
[setup instructions here](../promptstore_setup.md).

Before we begin, we must also perform an additional setup item.

## Create bucket for files in the Object Store

The default Object Store uses MinIO. After starting the containers using 
Docker Compose, open the Object Store at http://localhost:9000. The default
username and password is `minio` and `changeme`.

Create a new bucket by clicking the Plus button (bottom right), then clicking
the second option - "Create bucket". Enter "promptstore" as the bucket name.

## Load and index a document

Going back to the Prompt Store UI:

Expand the menu of options by selecting a Workspace. You can select a Workspace
by choosing one from the drop-down menu in the top-right corner under 
"Select Workspace". Alternatively, click "Workspaces" from the left menu and
then click the "Select" Action next to the workspace item.

Select the "Test Space". The menu of options on the left expands. Click 
"Knowledge" then "Documents".

There is a sample PDF document in the project folder under `examples/rag/`.
Drag that document, or other document of your choice, onto the "Upload" box.
Alternative, click the "Upload" box to open a file explorer.

The document may take a few minutes to upload. The content is extracted at the
same time. The whole process is done in the background so you can continue
using the application. To see the status of the job, you can open the Temporal
UI by clicking on "Observability" in the left menu then "Background Jobs".

Select the "promptstore" namespace (top right) then open the latest job, which
is the first item in the list. (Open a Job by clicking on the "Workflow ID" or
"Run ID" link).

Once the document is uploaded, the "Preview" Action is enabled. Clicking on
"Preview" opens a preview window showing the document contents. As much information
about the format that is useful to infer meaning, such as headings and tables,
is retained. The process is not perfect given the challenges of working with
some formats such as PDF which were intended for presentation, not to facilitate
text extraction.

Going back briefly to the MinIO UI, you can see the document has been uploaded
to the Object Store.

Coming back to the Prompt Store UI, click the "Create Source" Action to create
a Data Source from the document.

A Data Source may consist of multiple documents or reference another medium 
such as a database, Feature Store, or Web Scraper.

To go to the source, click on "Knowledge" then "Data Sources". You will see an
item with the same name as the document. Click on the item to see the details.
Click "Cancel".

Next, we want to index the Data Source we just created. Indexing involves 
computing embeddings from the source content, then loading the embeddings into
a Vector Store to facilitate semantic search when injecting knowledge into
the prompt.

Click the "Index" Action next to the Data Source item. This opens a window to
capture the required details. Click on the Index drop-down. Since an Index does
not already exist for this source, enter a new index name in the input box.
Enter "test_index" or a name of your choosing. Do not include spaces or symbols 
other than letters, numbers, dashes or underscores. Click the "Create New Index"
button next to the input box after entering a name. Finally, select the index
name just created.

Next choose the Vector Store. For this exercise, select the Redis Vector Store,
which is included as part of the default installation.

Then click "OK" to create the index.

To go to the index, click on "Knowledge" then "Semantic Indexes".
