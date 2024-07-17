import {
  useCallback,
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
  Input,
  InputNumber,
  Popover,
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
  selectLoaded as selectModelsLoaded,
  selectLoading as selectModelsLoading,
  selectModels,
} from '../models/modelsSlice';
import {
  getPromptSetsAsync,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';
import {
  createSettingAsync,
  getSettingsAsync,
  selectLoading as selectSettingsLoading,
  selectSettings,
  updateSettingAsync,
} from '../settings/settingsSlice';

import { VariationModalForm } from './VariationModalForm';
import {
  optionsMap,
  imageQualityOptions,
  imageResponseFormatOptions,
  dalleImageSizeOptions,
  stabilityImageSizeOptions,
  imageStyleOptions,
  imageAspectRatioOptions,
  imageOutputFormatOptions,
  imageStylePresetOptions,
} from './options';

const { TextArea } = Input;

export const initialValues = {
  maxTokens: 1024,
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
  createImage,
  hasImage,
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
      jsonMode: true,
      seed: true,
    };
  }

  const [isLoadFormOpen, setLoadFormOpen] = useState(false);
  const [isSaveFormOpen, setSaveFormOpen] = useState(false);
  const [isVariationModalOpen, setIsVariationModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [selectedVariationKey, setSelectedVariationKey] = useState(null);
  const [selectedVariationValues, setSelectedVariationValues] = useState([]);

  const models = useSelector(selectModels);
  const modelsLoaded = useSelector(selectModelsLoaded);
  const modelsLoading = useSelector(selectModelsLoading);
  const promptSets = useSelector(selectPromptSets);
  const settingsLoading = useSelector(selectSettingsLoading);
  const settings = useSelector(selectSettings);

  // console.log('models:', models);

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  const [form] = Form.useForm();
  const modelsValue = Form.useWatch('models', form);

  const modelKeys = useMemo(() => {
    if (modelsLoaded && modelsValue) {
      return modelsValue.map(id => models[id].key);
    }
    return [];
  }, [modelsLoaded, modelsValue]);

  const hasModelKeyStartingWith = useCallback((str) => {
    return modelKeys.some(key => key.startsWith(str));
  }, [modelKeys]);

  const variationsFormResetCallbackRef = useRef();

  useEffect(() => {
    const workspaceId = selectedWorkspace.id;
    if (includes['promptSet']) {
      dispatch(getPromptSetsAsync({ key: 'copy', workspaceId }));
    }
    dispatch(getModelsAsync({ workspaceId }));
    dispatch(getSettingsAsync({ key: 'model_configs', workspaceId }));
  }, [selectedWorkspace]);

  useEffect(() => {
    handleChange();
  }, [selectedVariationKey]);

  useEffect(() => {
    if (value) {
      const val = {
        ...value,
        models: (value.models || []).map(m => m.id),
        criticModels: (value.criticModels || []).map(m => m.id),
      };
      form.setFieldsValue(val);
    }
  }, [value]);

  const modelOptions = useMemo(() => {
    if (models) {
      const list = Object.values(models)
        .filter((m) => {
          return (
            (m.type === 'gpt' || m.type === 'imagegen') &&
            !m.disabled &&
            (hasImage ? m.multimodal : true) &&
            (createImage ? m.type === 'imagegen' : true)
          );
        })
        .map((m) => ({
          key: m.id,
          label: m.name,
          value: m.id,
        }));
      list.sort((a, b) => a.label < b.label ? -1 : 1);
      return list;
    }
    return [];
  }, [models, createImage, hasImage]);

  const modelConfigOptions = useMemo(() => {
    if (settings) {
      const configs = Object.values(settings).filter(s => s.key === 'model_configs');
      const list = configs.map(c => ({
        key: c.id,
        label: c.name,
        value: c.id,
      }));
      list.sort((a, b) => a.label < b.label ? -1 : 1);
      return list;
    }
    return [];
  }, [settings]);

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

  const handleLoad = ({ modelConfig }) => {
    // console.log('modelConfig:', modelConfig);
    if (modelConfig) {
      const setting = settings[modelConfig];
      // console.log('setting:', setting);
      form.setFieldsValue(setting.params);
      setLoadFormOpen(false);
      setSelectedConfig(setting);
    } else {
      setLoadFormOpen(false);
      setSelectedConfig(null);
    }
  };

  const handleLoadFormReset = () => {
    form.resetFields();
    setLoadFormOpen(false);
    setSelectedConfig(null);
  };

  const handleSave = async ({ name }) => {
    // console.log('name:', name);
    const params = await form.validateFields();
    if (selectedConfig && !name) {
      const values = { params };
      dispatch(updateSettingAsync({
        id: selectedConfig.id,
        values,
      }));
    } else {
      const values = {
        workspaceId: selectedWorkspace.id,
        key: 'model_configs',
        name,
        params,
      };
      dispatch(createSettingAsync({ values }));
    }
    setSaveFormOpen(false);
  };

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
            <Form.Item>
              <Popover
                open={isLoadFormOpen}
                title="Load model config"
                content={
                  <LoadForm
                    loading={settingsLoading}
                    onCancel={() => setLoadFormOpen(false)}
                    onLoad={handleLoad}
                    onReset={() => handleLoadFormReset()}
                    options={modelConfigOptions}
                  />
                }
              >
                <Space>
                  <Button type="primary"
                    size="small"
                    onClick={() => setLoadFormOpen(true)}
                  >
                    Load config
                  </Button>
                  <div>{selectedConfig?.name}</div>
                </Space>
              </Popover>
            </Form.Item>
            {includes['models'] ?
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
              : null
            }
            {includes['criticModels'] ?
              <Form.Item
                extra="Only the first 3 will be used"
                label="Eval Models"
                name="criticModels"
              >
                <Select allowClear
                  loading={modelsLoading}
                  mode="multiple"
                  options={modelOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
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
            {includes['jsonMode'] ?
              <Form.Item
                label="JSON"
                name="jsonMode"
                valuePropName="checked"
                tooltip="Force the model to return in JSON format. You should also set formatting instructions in your prompt."
              >
                <Switch />
              </Form.Item>
              : null
            }
            {includes['seed'] ?
              <Form.Item
                label="Seed"
                name="seed"
                tooltip="Make the model behave deterministically so it returns the same result every time."
              >
                <InputNumber />
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
            {includes['imageQuality'] ?
              <Form.Item
                label="Image Quality"
                name="quality"
              >
                <Select allowClear
                  options={imageQualityOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['imageResponseFormat'] ?
              <Form.Item
                label="Image Response Format"
                name="response_format"
              >
                <Select allowClear
                  options={imageResponseFormatOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['imageSize'] && hasModelKeyStartingWith('dall-e') ?
              <Form.Item
                label="DALL&#x2022;E Image Size"
                name="size"
              >
                <Select allowClear
                  options={dalleImageSizeOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['imageSize'] && hasModelKeyStartingWith('stability') ?
              <Form.Item
                label="Stability Image Size"
                name="size"
              >
                <Select allowClear
                  options={stabilityImageSizeOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['imageStyle'] && hasModelKeyStartingWith('dall-e') ?
              <Form.Item
                label="DALL&#x2022;E Image Style"
                name="style"
              >
                <Select allowClear
                  options={imageStyleOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['imageStyle'] && hasModelKeyStartingWith('stability') ?
              <Form.Item
                label="Stability Image Style"
                name="style_preset"
              >
                <Select allowClear
                  options={imageStylePresetOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['imageAspectRatio'] ?
              <Form.Item
                label="Aspect Ratio"
                name="aspect_ratio"
              >
                <Select allowClear
                  options={imageAspectRatioOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['negativePrompt'] ?
              <Form.Item
                label="Negative Prompt"
                name="negative_prompt"
              >
                <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
              </Form.Item>
              : null
            }
            {includes['imageOutputFormat'] ?
              <Form.Item
                label="Output Format"
                name="output_format"
              >
                <Select allowClear
                  options={imageOutputFormatOptions}
                  optionFilterProp="label"
                />
              </Form.Item>
              : null
            }
            {includes['disablePromptRewriting'] && hasModelKeyStartingWith('dall-e') ?
              <Form.Item
                label="Disable Prompt Rewriting"
                name="promptRewritingDisabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              : null
            }
            <Space>
              <Button onClick={clearFields} type="default" size="small">
                Reset
              </Button>
              <Popover
                open={isSaveFormOpen}
                title="Save model config"
                content={
                  <SaveForm
                    isConfigLoaded={!!selectedConfig}
                    onCancel={() => setSaveFormOpen(false)}
                    onSave={handleSave}
                  />
                }
              >
                <Button type="primary"
                  size="small"
                  onClick={() => setSaveFormOpen(true)}
                >
                  Save config
                </Button>
              </Popover>
            </Space>
          </div>
        </div>
      </Form>
    </>
  );
}

function LoadForm({ loading, onCancel, onLoad, onReset, options }) {

  const [form] = Form.useForm();

  const handleReset = () => {
    form.resetFields();
    onReset();
  };

  return (
    <div style={{ width: 275 }}>
      <Form
        form={form}
        onFinish={onLoad}
      >
        <Form.Item
          name="modelConfig"
        >
          <Select allowClear
            loading={loading}
            options={options}
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          style={{ marginBottom: 0 }}
        >
          <Space>
            <Button type="default"
              size="small"
              onClick={() => onCancel()}
            >
              Cancel
            </Button>
            <Button type="default"
              size="small"
              onClick={() => handleReset()}
            >
              Reset
            </Button>
            <Button type="primary"
              size="small"
              htmlType="submit"
            >
              OK
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  )
}

function SaveForm({ isConfigLoaded, onCancel, onSave }) {
  return (
    <div style={{ width: 275 }}>
      <Form
        onFinish={onSave}
      >
        <Form.Item
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter a name',
            },
          ]}
        >
          <Input
            autoComplete="off"
            placeholder={isConfigLoaded ? 'Leave blank to update current config' : 'Enter name'}
          />
        </Form.Item>
        <Form.Item
          style={{ marginBottom: 0 }}
        >
          <Space>
            <Button type="default"
              size="small"
              onClick={() => onCancel()}
            >
              Cancel
            </Button>
            <Button type="primary"
              size="small"
              htmlType="submit"
            >
              OK
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
