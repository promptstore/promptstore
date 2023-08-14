import axios from 'axios';
import * as chrono from 'chrono-node';

function SerpApiTool({ __key, __name, constants, logger }) {

  /**
   * Example response:
   * {
        "searchParameters": {
          "q": "Leonardo DiCaprio current girlfriend",
          "type": "search"
        },
        "organic": [
          {
            "title": "Leonardo DiCaprio Girlfriend New Update - - HOLR Magazine",
            "link": "https://holrmagazine.com/leonardo-dicaprio-girlfriend-new-update/",
            "snippet": "According to this TikTok by user @thekylemarisa, Leonardo DiCaprio allegedly has a new girlfriend- Meghan Roche.",
            "date": "Jun 4, 2023",
            "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwvdeQfUIIFPAO47CfXBe6w35zrc7MElZZwifQSx_u5LJcUGeRW0pIZ4M&s",
            "position": 1
          },
          {
            "title": "Leonardo DiCaprio Might Be Dating A 19-Year-Old Model & Twitter Is Popping Off - ELLE Australia",
            "link": "https://www.elle.com.au/celebrity/leonardo-dicaprio-eden-polani-girlfriend-2023-28203",
            "snippet": "The actor made headlines last year for breaking up with his 25-year-old girlfriend Camila Morrone, further fuelling the theory that he does not ...",
            "date": "Feb 7, 2023",
            "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_0kVC6cUY4MrVhBy_As7EXTITLkfeC0lt8fdCH_1Pag84vaiSHtLcPZc&s",
            "position": 2
          },
          {
            "title": "Neelam Gill, Leonardo DiCaprio's New Girlfriend? - Gulte",
            "link": "https://www.gulte.com/trends/244100/neelam-gill-leonardo-dicaprios-new-girlfriend",
            "snippet": "Neelam Gill, Leonardo DiCaprio's New Girlfriend? ... Hollywood superstar Leonardo DiCaprio is known for dating girls not more older than 30.",
            "date": "Jun 3, 2023",
            "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHrP1nQ6kaAJhTSddMiXgEywXzCVvNkd-ZbcrcG6KMA-IB4kVtI213mO0&s",
            "position": 3
          },
          {
            "title": "Leonardo Dicaprio's New Girlfriend - The Growling Wolverine",
            "link": "https://thegrowlingwolverine.org/3578/features/leonardo-dicaprios-new-girlfriend/",
            "snippet": "Shortly after breaking up with his girlfriend, Camila Morrone, , rumors have rapidly spread that the well-known Titanic actor Leonardo ...",
            "date": "Feb 28, 2023",
            "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTjWaF8dbKs78JV-5McrVZHk5PzYLkGmtd_jGMiJ1d729DS-FfYB5sva1Q&s",
            "position": 4
          },
          {
            "title": "Who is Leonardo DiCaprio's girlfriend? Leo's dating history revealed - Who Magazine",
            "link": "https://www.who.com.au/leonardo-dicaprio-dating-history",
            "snippet": "Leonardo DiCaprio has split from girlfriend Camila Morrone. Getty. Taking a look at his dating history, Leo has always had a preference for ...",
            "date": "Jun 5, 2023",
            "position": 5
          },
          {
            "title": "Just Jared on Instagram: “Leonardo DiCaprio & girlfriend Camila Morrone couple up for a lunch date! #LeonardoDiCaprio #CamilaMorrone Photos",
            "link": "https://www.instagram.com/p/CbYl6bIrxs6/?hl=en",
            "snippet": "Leonardo DiCaprio & girlfriend Camila Morrone couple up for a lunch date! · Sydney Sweeney and Noah Centineo met up at the Girgio Armani show during Paris ...",
            "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCpq-cpqeazz3sU4U_2ezzZm6-p8WfrhTPMOo2ob7-vHRIHwcf1CBgLLo&s",
            "position": 6
          },
          {
            "title": "Who is Meghan Roche, Leonardo DiCaprio's new 22-year-old model girlfriend?",
            "link": "https://www.cosmopolitanme.com/celebs/leo-dicaprio-meghan-roche-in-ibiza",
            "snippet": "The heartthrob actor, known for ~younger~ relationship entanglements, was recently spotted in Ibiza, living it up with 22-year-old model ...",
            "date": "Jun 5, 2023",
            "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSbEdMiSUsg-BzbBFkGWe1PW6_x8bNF3VKrZiFJPoNok8judNKc-SlQusw&s",
            "position": 7
          },
          {
            "title": "Eden Polani: Leonardo DiCaprio keeps getting older, but his girlfriends stay the same age",
            "link": "https://www.independent.co.uk/voices/leonardo-dicaprio-new-girlfriend-eden-polani-b2278717.html",
            "snippet": "Leonardo DiCaprio is rumored to be dating a 19-year-old model named Eden Polani, proving once again that this infamous Reddit graph charting ...",
            "date": "Feb 9, 2023",
            "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSY6hNXgLO46ADTN4ySiDYRMMUJ4rZAWil2MZIHi3wV-2QrCCcK67D7nps&s",
            "position": 8
          },
          {
            "title": "Leonardo DiCaprio brings young model out to dinner with his mom - New York Post",
            "link": "https://nypost.com/2023/05/31/leonardo-dicaprio-neelam-gill-double-date-with-his-mom/",
            "snippet": "Leonardo DiCaprio and model Neelam Gill broke bread with his mother, Irmelin Indenbirken, on Tuesday night in London. More On: leonardo dicaprio ...",
            "date": "May 31, 2023",
            "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnLoyW9HvnxYCRgTC9iWkYmgaxhxASOxK12yyv6kMV-uegY4DNUDuY7UI&s",
            "position": 9
          }
        ],
        "relatedSearches": [
          {
            "query": "How many girlfriends has Leonardo DiCaprio had"
          },
          {
            "query": "How old is Leonardo DiCaprio in Titanic"
          },
          {
            "query": "Leonardo DiCaprio Love Island"
          },
          {
            "query": "Leonardo DiCaprio teenager"
          },
          {
            "query": "Leonardo DiCaprio Reddit graph"
          },
          {
            "query": "Leonardo DiCaprio Twitter"
          },
          {
            "query": "Leonardo DiCaprio on love"
          },
          {
            "query": "Leonardo DiCaprio Titanic tweet"
          }
        ]
      }
   * 
   * @param {*} param0 
   * @returns 
   */
  async function call({ input }) {
    const config = {
      method: 'post',
      url: constants.SERPAPI_URL,
      headers: {
        'X-API-KEY': constants.SERPAPI_KEY,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({ q: input }),
    };
    const res = await axios(config);
    const hits = res.data.organic.map((hit) => ({
      dateStr: hit.date,
      date: hit.date ? chrono.parseDate(hit.date) : new Date(1970, 0, 1),
      snippet: hit.snippet,
    }));
    hits.sort((a, b) => a.date > b.date ? -1 : 1);
    // logger.debug('hits:', hits);
    // const hitsList = hits.map((hit) => (hit.dateStr ? hit.dateStr + ': ' : '') + hit.snippet);
    // const result = [
    //   constants.SERPAPI_RESULT_PREFIX,
    //   ...hitsList
    // ].join('\n\n');
    const result = hits.map((hit) => hit.snippet).join(' ');
    return result;
  }

  function getOpenAIMetadata() {
    return {
      name: __key,
      description: constants.SERPAPI_DESCRIPTION,
      parameters: {
        properties: {
          input: {
            description: 'Input text',
            type: 'string',
          },
        },
        required: ['input'],
        type: 'object',
      },
    };
  }

  return {
    __name,
    __description: constants.SERPAPI_DESCRIPTION,
    call,
    getOpenAIMetadata,
  };
}

export default SerpApiTool;