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

const initialValues = {
  maxTokens: 255,
  n: 1,
  temperature: 1,
  topP: 1,
};

export function ModelParamsForm({
  includes,
  onChange,
  tourRefs,
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

  const modelOptions = useMemo(() => {
    if (models) {
      return Object.values(models)
        .filter((m) => m.type === 'gpt')
        .map((m) => ({
          key: m.id,
          label: m.name,
          value: m.id,
        }));
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
  }

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
        return { model: key, provider };
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
              label="Compare Models"
              name="models"
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
              >
                <InputNumber ref={tourRefs?.maxTokens} />
              </Form.Item>
              : null
            }
            {includes['temperature'] ?
              <Form.Item
                label="Temperature"
                name="temperature"
              >
                <Slider min={0.1} max={2.0} step={0.1} />
              </Form.Item>
              : null
            }
            {includes['topP'] ?
              <Form.Item
                label="Top-p"
                name="topP"
              >
                <Slider min={0.05} max={1} step={0.05} />
              </Form.Item>
              : null
            }
            {includes['promptSet'] ?
              <Form.Item
                label="Prompt Set"
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
                colon={false}
                label="Allow Emojis?"
                name="allowEmojis"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              : null
            }
          </div>
        </div>
      </Form>
    </>
  );
}