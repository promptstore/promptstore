import isEmpty from 'lodash.isempty';

import { deepDiffMapperChangesOnly, merge } from '../utils';

const DEFAULT_MODEL = {
  provider: 'openai',
  model: 'gpt-3.5-turbo-0613',
};

const DEFAULT_INPUT_TOKENS = 1000;

const DEFAULT_OUTPUT_TOKENS = 500;

const DEFAULT_IMAGE_QUALITY = 'standard';

const INFRA_COST_PER_CALL = 0.003;

const COSTS = {
  'ai21.j2-mid-v1': {
    'currency': 'usd',
    'type': 'text',
    'bedrock': {
      'online': {
        'input-per-1k-tokens': 0.0125,
        'output-per-1k-tokens': 0.0125,
      },
    },
  },
  'ai21.j2-ultra-v1': {
    'currency': 'usd',
    'type': 'text',
    'bedrock': {
      'online': {
        'input-per-1k-tokens': 0.0188,
        'output-per-1k-tokens': 0.0188,
      },
    },
  },
  'anthropic.claude-v1': {
    'currency': 'usd',
    'type': 'text',
    'bedrock': {
      'online': {
        'input-per-1k-tokens': 0.008,
        'output-per-1k-tokens': 0.024,
      },
    },
  },
  'anthropic.claude-v2': {
    'currency': 'usd',
    'type': 'text',
    'bedrock': {
      'online': {
        'input-per-1k-tokens': 0.008,
        'output-per-1k-tokens': 0.024,
      },
    },
  },
  'anthropic.claude-v2:1': {
    'currency': 'usd',
    'type': 'text',
    'bedrock': {
      'online': {
        'input-per-1k-tokens': 0.008,
        'output-per-1k-tokens': 0.024,
      },
    },
  },
  'anthropic.claude-instant-v1': {
    'currency': 'usd',
    'type': 'text',
    'bedrock': {
      'online': {
        'input-per-1k-tokens': 0.0008,
        'output-per-1k-tokens': 0.0024,
      },
    },
  },
  'cohere.command-text-v14': {
    'currency': 'usd',
    'type': 'text',
    'bedrock': {
      'online': {
        'input-per-1k-tokens': 0.0015,
        'output-per-1k-tokens': 0.002,
      },
    },
  },
  'cohere.embed-english-v3': {
    'currency': 'usd',
    'type': 'embedding',
    'bedrock': {
      'online': {
        'input-per-1k-tokens': 0.0001,
      },
    },
  },
  'falcon-40b-instruct': {
    'currency': 'usd',
    'type': 'text',
    'llamaapi': {
      'online': {
        'input-per-1k-tokens': 0.0032,
        'output-per-1k-tokens': 0.0032,
      },
    },
  },
  'models/code-gecko': {
    'currency': 'usd',
    'type': 'text',
    'vertexai': {
      'online': {
        'input-per-1k-tokens': 0.00025,
        'output-per-1k-tokens': 0.0002,
      },
    },
  },
  'models/embedding-gecko-001': {
    'currency': 'usd',
    'type': 'embedding',
    'vertexai': {
      'online': {
        'input-per-1k-tokens': 0.0004,
      },
    },
  },
  'gemini-pro': {
    'currency': 'usd',
    'type': 'text',
    'gemini': {
      'online': {
        'input-per-1k-tokens': 0.001,
        'output-per-1k-tokens': 0.002,
      },
    },
  },
  'gemini-pro-vision': {
    'currency': 'usd',
    'type': 'multimodal',
    'gemini': {
      'online': {
        'per-image': 0.0025,
        'video-per-second': 0.002,
        'input-per-1k-tokens': 0.00025,
        'output-per-1k-tokens': 0.0005,
      },
    },
  },
  'models/chat-bison-001': {
    'currency': 'usd',
    'type': 'text',
    'vertexai': {
      'online': {
        'input-per-1k-tokens': 0.002,
        'output-per-1k-tokens': 0.002,
      }
    },
  },
  'models/code-bison-001': {
    'currency': 'usd',
    'type': 'text',
    'vertexai': {
      'online': {
        'input-per-1k-tokens': 0.00025,
        'output-per-1k-tokens': 0.0005,
      },
    },
  },
  'models/text-bison-001': {
    'currency': 'usd',
    'type': 'text',
    'vertexai': {
      'online': {
        'input-per-1k-tokens': 0.00025,
        'output-per-1k-tokens': 0.002,
      },
      'batch': {
        'input-per-1k-tokens': 0.0005,
        'output-per-1k-tokens': 0.0004,
      },
    },
  },
  'llama-13b-chat': {
    'currency': 'usd',
    'type': 'text',
    'llamaapi': {
      'online': {
        'input-per-1k-tokens': 0.0016,
        'output-per-1k-tokens': 0.0016,
      },
    },
  },
  'llama2': {

  },
  'llama-70b-chat': {
    'currency': 'usd',
    'type': 'text',
    'llamaapi': {
      'online': {
        'input-per-1k-tokens': 0.0032,
        'output-per-1k-tokens': 0.0032,
      },
    },
  },
  'llama-7b-chat': {
    'currency': 'usd',
    'type': 'text',
    'llamaapi': {
      'online': {
        'input-per-1k-tokens': 0.0016,
        'output-per-1k-tokens': 0.0016,
      },
    },
  },
  'mistral-embed': {
    'currency': 'euro',
    'type': 'embedding',
    'mistral': {
      'online': {
        'input-per-1k-tokens': 0.0001,
      },
    },
  },
  'mistral-medium': {
    'currency': 'euro',
    'type': 'text',
    'mistral': {
      'online': {
        'input-per-1k-tokens': 0.0025,
        'output-per-1k-tokens': 0.0075,
      },
    },
  },
  'mistral-small': {
    'currency': 'euro',
    'type': 'text',
    'mistral': {
      'online': {
        'input-per-1k-tokens': 0.0006,
        'output-per-1k-tokens': 0.0018,
      },
    },
  },
  'mistral-tiny': {
    'currency': 'euro',
    'type': 'text',
    'mistral': {
      'online': {
        'input-per-1k-tokens': 0.00014,
        'output-per-1k-tokens': 0.00042,
      },
    },
  },
  'code-davinci-002': {
    'currency': 'usd',
    'type': 'text',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.002,
        'output-per-1k-tokens': 0.002,
      },
    },
  },
  'dall-e-3': {
    'currency': 'usd',
    'type': 'image',
    'openai': {
      'online': {
        'image-quality': {
          'standard': {
            'breakpoints': [
              {
                'dim': 1024,
                'price': 0.04,
              },
              {
                'dim': 1792,
                'price': 0.08,
              },
            ],
          },
          'hd': {
            'breakpoints': [
              {
                'dim': 1024,
                'price': 0.08,
              },
              {
                'dim': 1792,
                'price': 0.12,
              },
            ],
          },
        },
      },
    },
  },
  'dall-e-2': {
    'currency': 'usd',
    'type': 'image',
    'openai': {
      'online': {
        'image-quality': {
          'standard': {
            'breakpoints': [
              {
                'dim': 256,
                'price': 0.016,
              },
              {
                'dim': 512,
                'price': 0.018,
              },
              {
                'dim': 1024,
                'price': 0.02,
              },
            ],
          },
        },
      },
    },
  },
  'text-embedding-ada-002': {
    'currency': 'usd',
    'type': 'embedding',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.0001,
      },
    },
  },
  'gpt-3.5-turbo-0613': {
    'currency': 'usd',
    'type': 'text',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.001,
        'output-per-1k-tokens': 0.002,
      },
    },
  },
  'gpt-3.5-turbo-1106': {
    'currency': 'usd',
    'type': 'text',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.001,
        'output-per-1k-tokens': 0.002,
      },
    },
  },
  'gpt-3.5-turbo-instruct': {
    'currency': 'usd',
    'type': 'text',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.0015,
        'output-per-1k-tokens': 0.002,
      },
    },
  },
  'text-curie-001': {
    'currency': 'usd',
    'type': 'text',
    'openai': {

    },
  },
  'gpt-4': {
    'currency': 'usd',
    'type': 'text',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.03,
        'output-per-1k-tokens': 0.06,
      },
    },
  },
  'gpt-4-32k': {
    'currency': 'usd',
    'type': 'text',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.07,
        'output-per-1k-tokens': 0.12,
      },
    },
  },
  'gpt-4-1106-preview': {
    'currency': 'usd',
    'type': 'text',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.01,
        'output-per-1k-tokens': 0.03,
      },
    },
  },
  'gpt-4-vision-preview': {
    'currency': 'usd',
    'type': 'multimodal',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.01,
        'output-per-1k-tokens': 0.03,
        'image-quality': {
          'standard': {
            'breakpoints': [
              {
                'dim': 0,
                'price': 0.00255,
              },
              {
                'dim': 1024,
                'price': 0.00765,
              },
            ],
          },
          'lores': {
            'breakpoints': [
              {
                'dim': 0,
                'price': 0.00085,
              },
            ],
          },
        },
      },
    },
  },
  'text-davinci-003': {
    'currency': 'usd',
    'type': 'text',
    'openai': {
      'online': {
        'input-per-1k-tokens': 0.002,
        'output-per-1k-tokens': 0.002,
      },
    },
  },
  'vicuna-13b': {
    'currency': 'usd',
    'type': 'text',
    'llamaapi': {
      'online': {
        'input-per-1k-tokens': 0.0016,
        'output-per-1k-tokens': 0.0016,
      },
    },
  },
};

const currencyExchangeToUSD = {
  'euro': 1.1
};

export function CreditCalculatorService({ logger, services }) {

  const { modelsService } = services;

  async function getCostComponents({
    name,
    provider,
    model,
    batch,
    inputTokens = 0,
    outputTokens = 0,
    images,
    imageCount = 0,
    videoSeconds = 0,
    workspaceId,
  }) {
    const mymodel = await modelsService.getModelByKey(workspaceId, model);
    let mdl;
    if (mymodel && mymodel.costs?.length) {
      const currency = mymodel.currency || 'USD';
      mdl = {};
      for (const costElement of mymodel.costs) {
        let costFields;
        let type;
        if (costElement.type === 'text') {
          if (mymodel.type === 'embedding') {
            type = 'embedding';
            costFields = {
              'input-per-1k-tokens': costElement.inputPer1kTokens,
            };
          } else {
            type = 'text';
            costFields = {
              'input-per-1k-tokens': costElement.inputPer1kTokens,
              'output-per-1k-tokens': costElement.outputPer1kTokens,
            };
          }
        } else if (costElement.type === 'multimodal') {
          type = 'multimodal';
          costFields = {
            'input-per-1k-tokens': costElement.inputPer1kTokens,
            'output-per-1k-tokens': costElement.outputPer1kTokens,
            'per-image': costElement.perInputImage,
            'video-per-second': costElement.videoPerSecond,
          };
        } else if (costElement.type === 'image') {
          type = 'image';
          costFields = {
            'image-quality': {
              [costElement.imageQuality]: {
                breakpoints: costElement.imageBreakpoints?.map(bp => ({
                  dim: bp.dim,
                  price: bp.price,
                })),
              }
            },
          };
        }
        const value = {
          currency,
          type,
          [mymodel.provider]: {
            [costElement.mode]: costFields,
          },
        };
        const diff = deepDiffMapperChangesOnly.map(mdl, value);
        // default behaviour is to 'leave' in event of conflict
        const { merged, conflicts } = merge(mdl, value, diff);
        if (conflicts?.length) {
          logger.debug('conflicts:', conflicts);
        }
        logger.debug('merged:', merged);
        mdl = merged;
      }
    } else {
      mdl = COSTS[model];
    }
    logger.debug('model costs:', mdl);
    const costComponents = { name };
    let totalCost = 0;
    if (mdl) {
      const type = mdl.type;
      const xrate = currencyExchangeToUSD[mdl.currency] || 1;
      costComponents.xrate = xrate;
      const entry = mdl[provider];
      if (entry) {
        let params;
        if (batch) {
          params = entry.batch;
        }
        if (!params) {
          params = entry.online;
        }
        if (params) {
          if (type === 'embedding') {
            const inputTokensCost = (params['input-per-1k-tokens'] / 1000) * inputTokens * xrate;
            costComponents.inputCostPer1kTokens = params['input-per-1k-tokens'];
            costComponents.inputTokenCount = inputTokens;
            costComponents.inputTokensCost = inputTokensCost;
            totalCost += inputTokensCost;
          } else if (type === 'text' || type === 'multimodal') {
            const inputTokensCost = (params['input-per-1k-tokens'] / 1000) * inputTokens * xrate;
            costComponents.inputCostPer1kTokens = params['input-per-1k-tokens'];
            costComponents.inputTokenCount = inputTokens;
            costComponents.inputTokensCost = inputTokensCost;
            totalCost += inputTokensCost;
            const outputTokensCost = (params['output-per-1k-tokens'] / 1000) * outputTokens * xrate;
            costComponents.outputCostPer1kTokens = params['output-per-1k-tokens'];
            costComponents.outputTokenCount = outputTokens;
            costComponents.outputTokensCost = outputTokensCost;
            totalCost += outputTokensCost;
          }
          if (type === 'image') {
            if (params['image-quality'] && images?.length) {
              let { quality, width, height } = images[0];
              if (!quality) {
                quality = DEFAULT_IMAGE_QUALITY;
              }
              const breakpoints = params['image-quality'][quality]?.breakpoints;
              if (breakpoints?.length) {
                let p = breakpoints[0];
                for (const p1 of breakpoints) {
                  if (width < p1.dim && height < p1.dim) {
                    break;
                  }
                  p = p1;
                }
                const imageGenCost = p.price * imageCount * xrate;
                costComponents.imageBreakpointPrice = p.price;
                costComponents.imageCount = imageCount;
                costComponents.imageGenCost = imageGenCost;
                totalCost += imageGenCost;
              }
            }
          }
          if (type === 'multimodal') {
            if (params['image-quality'] && images?.length) {
              const ims = [];
              for (const im of images) {
                let { quality, width, height } = im;
                if (!quality) {
                  quality = DEFAULT_IMAGE_QUALITY;
                }
                const breakpoints = params['image-quality'][quality]?.breakpoints;
                let cost = 0;
                let p;
                if (breakpoints?.length) {
                  p = breakpoints[0];
                  for (const p1 of breakpoints) {
                    if (width < p1.dim && height < p1.dim) {
                      break;
                    }
                    p = p1;
                  }
                  cost = p.price * xrate;
                }
                ims.push({
                  ...im,
                  unitCost: p?.price,
                  quality,
                  width,
                  height,
                  cost,
                });
                totalCost += cost;
              }
              costComponents.images = ims;
            }
            if (params['per-image']) {
              const imageUploadCost = params['per-image'] * imageCount * xrate;
              costComponents.pricePerImage = params['per-image'];
              costComponents.imageCount = imageCount;
              costComponents.imageUploadCost = imageUploadCost;
              totalCost += imageUploadCost;
            }
            if (params['video-per-second']) {
              const videoUploadCost = params['video-per-second'] * videoSeconds * xrate;
              costComponents.pricePerVideoSecond = params['video-per-second'];
              costComponents.videoSeconds = videoSeconds;
              costComponents.videoUploadCost = videoUploadCost;
              totalCost += videoUploadCost;
            }
          }
        }
      }
    }
    if (isEmpty(costComponents)) {
      return getCostComponents({
        ...DEFAULT_MODEL,
        batch,
        inputTokens: inputTokens || DEFAULT_INPUT_TOKENS,
        outputTokens: outputTokens || DEFAULT_OUTPUT_TOKENS,
      });
    }
    costComponents.infraCost = INFRA_COST_PER_CALL;
    totalCost += INFRA_COST_PER_CALL;
    costComponents.totalCost = totalCost;

    return costComponents;
  }

  const getImageCostComponents = (name, provider, model, batch, quality, width, height, response) => {
    const { data, usage } = response;
    const { prompt_tokens, completion_tokens } = usage || {};
    return getCostComponents({
      name,
      provider,
      model,
      batch,
      inputTokens: prompt_tokens,
      outputTokens: completion_tokens,
      image: [{ quality, width, height }],
      imageCount: data?.length,
    });
  };

  function getCreditsPerCall() {
    return Object.entries(COSTS).reduce((a, [k, v]) => {
      const xrate = currencyExchangeToUSD[v.currency] || 1;
      const provider = Object.keys(v).filter(p => !['currency', 'type'].includes(p))[0];
      let cost = 0;
      if (provider) {
        const params = v[provider]?.online;
        if (params) {
          if (params['input-per-1k-tokens']) {
            cost += (params['input-per-1k-tokens'] / 1000) * 1024 * xrate;
          }
          if (params['output-per-1k-tokens']) {
            cost += (params['output-per-1k-tokens'] / 1000) * 512 * xrate;
          }
          if (params['image-quality']) {
            const breakpoints = params['image-quality']['standard']?.breakpoints;
            if (breakpoints?.length) {
              let p = breakpoints[0];
              for (const p1 of breakpoints) {
                if (4096 < p1.dim) {
                  break;
                }
                p = p1;
              }
              cost += p.price * xrate;
            }
          }
          if (params['per-image']) {
            cost += params['per-image'] * xrate;
          }
        }
      }
      if (cost > 0) {
        a[k] = (cost + INFRA_COST_PER_CALL) * 1000;
      }
      return a;
    }, {});
  }

  return {
    getCostComponents,
    getImageCostComponents,
    getCreditsPerCall,
  };
}