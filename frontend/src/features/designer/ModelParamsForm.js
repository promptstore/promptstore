import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useDispatch,
  useSelector,
} from 'react-redux';
import {
  Button,
  Form,
  InputNumber,
  Select,
  Slider,
  Space,
  Switch,
} from 'antd';
import {
  MinusCircleOutlined,
} from '@ant-design/icons';

import { TagsInput } from '../../components/TagsInput';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getModelsAsync,
  selectLoading as selectModelsLoading,
  selectModels,
} from '../models/modelsSlice';
import {
  getPromptSetsAsync,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';

import { VariationModalForm } from './VariationModalForm';
import {
  optionsMap,
} from './options';

export const initialValues = {
  maxTokens: 64,
  n: 1,
  temperature: 1,
  topP: 1,
  topK: 40,
  models: [],
  criticModels: [],
  frequencyPenalty: 0,
  presencePenalty: 0,
  stop: [],
};

export function ModelParamsForm({
  includes,
  onChange,
  tourRefs,
  value,
}) {

  if (!includes) {
    includes = {
      variation: true,
      maxTokens: true,
      temperature: true,
      topP: true,
      promptSet: true,
      allowEmojis: true,
    };
  }

  const [isVariationModalOpen, setIsVariationModalOpen] = useState(false);
  const [selectedVariationKey, setSelectedVariationKey] = useState(null);
  const [selectedVariationValues, setSelectedVariationValues] = useState([]);

  const models = useSelector(selectModels);
  const modelsLoading = useSelector(selectModelsLoading);
  const promptSets = useSelector(selectPromptSets);

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  const [form] = Form.useForm();

  const variationsFormResetCallbackRef = useRef();

  useEffect(() => {
    const workspaceId = selectedWorkspace.id;
    if (includes['promptSet']) {
      dispatch(getPromptSetsAsync({ key: 'copy', workspaceId }));
    }
    dispatch(getModelsAsync({ workspaceId }));
  }, [selectedWorkspace]);

  useEffect(() => {
    handleChange();
  }, [selectedVariationKey]);

  useEffect(() => {
    if (value) {
      form.setFieldsValue(value);
    }
  }, [value]);

  const modelOptions = useMemo(() => {
    if (models) {
      const list = Object.values(models)
        .filter((m) => m.type === 'gpt' && !m.disabled)
        .map((m) => ({
          key: m.id,
          label: m.name,
          value: m.id,
        }));
      list.sort((a, b) => a.label < b.label ? -1 : 1);
      return list;
    }
    return [];
  }, [models]);

  const promptSetOptions = useMemo(() => {
    if (promptSets) {
      return Object.values(promptSets).map((s) => ({
        key: s.id,
        label: s.name,
        value: s.id,
      }));
    }
    return [];
  }, [promptSets]);

  let selectedVariations = null;
  if (selectedVariationKey && selectedVariationValues) {
    if (selectedVariationKey === 'prompt') {
      selectedVariations = `${selectedVariationValues.length} Prompt Sets`;
    } else {
      selectedVariations = `${selectedVariationValues.length} ${optionsMap[selectedVariationKey][0]}`;
    }
  };

  const clearFields = () => {
    form.resetFields();
  };

  const handleChange = () => {
    const values = form.getFieldsValue(true);
    const params = { ...values };
    if (selectedVariationKey && selectedVariationValues.length) {
      params.variations = {
        key: selectedVariationKey,
        values: selectedVariationValues,
      };
    }
    if (params.models) {
      params.models = params.models.map((id) => {
        const { key, provider } = models[id];
        return { id, model: key, provider };
      });
    }
    if (params.criticModels) {
      params.criticModels = params.criticModels.map((id) => {
        const { key, provider } = models[id];
        return { id, model: key, provider };
      });
    }
    if (typeof onChange === 'function') {
      onChange(params);
    }
  };

  const handleVariationCancel = () => {
    setIsVariationModalOpen(false);
  };

  const handleVariationSet = ({ key, values }) => {
    setIsVariationModalOpen(false);
    setSelectedVariationKey(key);
    setSelectedVariationValues(values);
  };

  const registerVariationsFormResetCallback = (callback) => {
    variationsFormResetCallbackRef.current = callback;
  };

  const unsetVariations = () => {
    setSelectedVariationKey(null);
    setSelectedVariationValues(null);
    variationsFormResetCallbackRef.current();
  };

  const SetVariationsControl = () => (
    <Space>
      <Button ref={tourRefs?.variations} type="default"
        onClick={() => setIsVariationModalOpen(true)}
      >
        Set
      </Button>
      <div className="small">{selectedVariations}</div>
      {selectedVariations ?
        <Button type="text"
          icon={<MinusCircleOutlined />}
          onClick={unsetVariations}
          title="Unset"
        />
        : null
      }
    </Space>
  );

  return (
    <>
      <VariationModalForm
        open={isVariationModalOpen}
        onOk={handleVariationSet}
        onCancel={handleVariationCancel}
        promptSetOptions={promptSetOptions}
        registerResetCallback={registerVariationsFormResetCallback}
      />
      <Form
        autoComplete="off"
        form={form}
        initialValues={initialValues}
        layout="vertical"
        name="copy-params"
        onValuesChange={handleChange}
      >
        <div id="params-form">
          <div>
            <Form.Item
              extra="Only the first 3 will be used"
              label="Use/Compare Models"
              name="models"
            >
              <Select allowClear
                loading={modelsLoading}
                mode="multiple"
                options={modelOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              extra="Only the first 3 will be used"
              label="Critic Models"
              name="criticModels"
            >
              <Select allowClear
                loading={modelsLoading}
                mode="multiple"
                options={modelOptions}
                optionFilterProp="label"
              />
            </Form.Item>
            {includes['variation'] ?
              <div className="fields-container">
                <label>Variation</label>
                <div className="form-section">
                  <Form.Item
                    label="By Category"
                    name="variations"
                  >
                    <SetVariationsControl />
                  </Form.Item>
                  <div>&mdash; or &mdash;</div>
                  <Form.Item
                    label="Number"
                    name="n"
                  >
                    <InputNumber />
                  </Form.Item>
                </div>
              </div>
              : null
            }
            {includes['maxTokens'] ?
              <Form.Item
                label="Max Tokens"
                name="maxTokens"
                tooltip={<div>The maximum number of tokens to <span style={{ fontWeight: 600 }}>generate</span> shared between the prompt and completion. The exact limit varies by model. (One token is roughly 4 characters for standard English text.)</div>}
              >
                <InputNumber ref={tourRefs?.maxTokens} />
              </Form.Item>
              : null
            }
            {includes['temperature'] ?
              <Form.Item
                label="Temperature"
                name="temperature"
                tooltip="Controls randomness: lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive."
              >
                <Slider min={0.1} max={2.0} step={0.1} />
              </Form.Item>
              : null
            }
            {includes['topP'] ?
              <Form.Item
                label="Top-p"
                name="topP"
                tooltip="Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered."
              >
                <Slider min={0.05} max={1.0} step={0.05} />
              </Form.Item>
              : null
            }
            {includes['topK'] ?
              <Form.Item
                label="Top-k"
                name="topK"
                tooltip="This setting only applies to PaLM models. The maximum number of tokens to consider when sampling. Top-k sampling considers the set of top_k most probable tokens."
              >
                <InputNumber />
              </Form.Item>
              : null
            }
            {includes['frequencyPenalty'] ?
              <Form.Item
                label="Frequency penalty"
                name="frequencyPenalty"
                tooltip="How much to oenalize new tokens based on their existing frequency in the text so far. It decreases the model's likelihood to repeat the same line verbatim."
              >
                <Slider min={-2.0} max={2.0} step={0.05} />
              </Form.Item>
              : null
            }
            {includes['presencePenalty'] ?
              <Form.Item
                label="Presence penalty"
                name="presencePenalty"
                tooltip="How much to penalize new tokens based on whether they appear in the text so far. It increases the model's likelihood to talk about new topics."
              >
                <Slider min={-2.0} max={2.0} step={0.05} />
              </Form.Item>
              : null
            }
            {includes['stopSequences'] ?
              <Form.Item
                label="Stop sequences"
                name="stop"
                tooltip="Up to four sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence."
              >
                <TagsInput />
              </Form.Item>
              : null
            }
            {includes['promptSet'] ?
              <Form.Item
                label="Prompt"
                name="promptSet"
              >
                <Select allowClear
                  options={promptSetOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['allowEmojis'] ?
              <Form.Item
                label="Allow Emojis"
                name="allowEmojis"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              : null
            }
            <Button onClick={clearFields} type="default" size="small">
              Reset
            </Button>
          </div>
        </div>
      </Form>
    </>
  );
}