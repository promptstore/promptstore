# A Summarization Service

Prerequisites:

- Docker
- docker-compose

## Start Prompt Store.

    git clone git@github.com:promptstore/promptstore.git
    cd promptstore
    cp .env.template .env
    cp .vecsearch.env.template .vecsearch.env
    cp backend/.env.template backend/.env

Edit `backend/.env`, set `OPENAI_API_KEY`.

    cp frontend/.env.template frontend/.env
    cd frontend
    npm i --legacy-peer-deps
    npm run build
    cd ..
    docker-compose up postgresql

Once postgresql has fully started:

    Ctrl+C
    docker-compose up --build

In a separate window/tab:

    docker exec -it --env TEMPORAL_CLI_ADDRESS=temporal:7233 temporal-admin-tools tctl --namespace promptstore namespace register

## Get the Prompt Store SDK

In a separate window/tab, get the Prompt Store SDK:

    git clone git@github.com:promptstore/promptstore-sdk.git
    cd promptstore-sdk
    cp .env.template .env

Edit .env with the following values:

    PROMPTSTORE_BASE_URL=http://localhost:5001/api
    PROMPTSTORE_API_KEY=41317739-f8e4-4419-b64b-30666e255391
    WORKSPACE_ID=1

Setup Python environment:

    python -m venv venv
    . venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt

Setup Node environment:

On OS X, ensure that libsodium is installed:

    brew install libsodium

Then install node packages:

    npm i

Make sure tslab command is available in your terminal.

    npm install -g tslab
    tslab install --version

Register tslab to your Jupyter environment.

    tslab install

Start Jupyter

    jupyter lab

Open demo.ipynb using the TypeScript kernel.

## Run the notebook

Run through the notebook to see how the PromptStore SDK interacts with the API
to create a Summarization Service.

Let's first look at the Trace of the request through the Prompt Store.

## Use the Prompt Store UI

Open the Prompt Store UI at http://localhost:5001. On the left menu, click on
"Observability", then "Traces". Open the first item by clicking on the name
or the "View" action on the right.

This will show a tree. The top level shows the input and final output. Drill
down into the tree to see the intermediate steps including filling the prompt
template (call-prompt-template) and calling the LLM (call-model).

## Change the Prompt

Next, let's make a revision to the Prompt Template. On the left menu, click on
"Prompt Engineering", then "Prompt Templates". Open the item with the name
"Summarize" by clicking on the name or the "Edit" action on the right.

In the Prompts section, you can see the Prompt used to instruct the model to
generate the summary. The format might be unfamiliar and seem wordy. Why not
just say "Create a summary of..."? The nature of an LLM is that this could 
work. However, experience as shown, that the most reliable results are produced
by being more specific.

Another way to think about the process is that LLMs are story telling machines.
As in any story, the setup is important to the plot. Prompt Engineering is in 
essence setting up the plot for the machine to complete the story in a way that
matches the task at hand. We're trying to avoid a story completion that might 
involve getting a description of what a summary is, a summary that includes details
not in the original text, etc. However, there is no one right way to achieve
this.

Refine or change the prompt as you like. Here is a suggestion:

    Provide a concise summary of the content below. The summary should cover all the key points and main ideas presented in the original content while condensing the information into a concise and easy-to-understand format. Ensure that the summary includes relevant details and examples that support the main ideas, while avoiding any unnecessary information or repetition. The length of the summary should be appropriate for the length and complexity of the original text, providing a clear and accurate overview without omitting any important information.

    Content:
    ${content}

The word in `${ }` is called a variable, and is substituted with text provided in
the request.

Create a new version of the prompt by clicking on "Save & Create Version".

Next, on the left menu, click on "Model Execution", then "Semantic Functions".
Open the item with the name "summarize" by clicking on the name or the "Edit"
action on the right.

In the Implementations section, find "Template Version". The latest version is
selected by default. (We could use the older version by selecting it in this
drop-down.) Click "Cancel".

## Re-run the notebook

Go back to the notebook, and re-run the cells. Hopefully, you should still get
a valid summary. If not, try changing the prompt again, or rollback to the 
original version.

(In my test, using the alternative prompt proposed above, I received a valid
summary albeit a little longer.)

You can navigate back to the Traces to verify that the new version of the prompt
was in fact used.
