import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Select, Space } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

import { RulesInput } from '../../components/RulesInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getGraphAsync,
  selectGraphs,
  selectLoaded as selectGraphsLoaded,
} from '../indexes/graphsSlice';
import {
  getIndexesAsync,
  selectLoaded as selectIndexesLoaded,
  selectLoading as selectIndexesLoading,
  selectIndexes,
} from '../indexes/indexesSlice';
import { humanize } from '../../utils';

import {
  createRuleAsync,
  getRuleAsync,
  selectLoaded,
  selectRules,
  updateRuleAsync,
} from './rulesSlice';

import './RulesEditor.css';

const layout = {
  labelCol: { span: 5 },
  wrapperCol: { span: 16 },
};

const emptyTarget = {
  target_id: 'empty',
  label: 'Select',
  type_id: 'string',
  attr_type: null,
};

export function RuleForm() {

  const [targetValuesLoaded, setTargetValuesLoaded] = useState(false);

  const graphs = useSelector(selectGraphs);
  const graphsLoaded = useSelector(selectGraphsLoaded);
  const indexes = useSelector(selectIndexes);
  const indexesLoaded = useSelector(selectIndexesLoaded);
  const indexesLoading = useSelector(selectIndexesLoading);
  const loaded = useSelector(selectLoaded);
  const rules = useSelector(selectRules);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const indexIdValue = Form.useWatch('indexId', form);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const id = location.pathname.match(/\/rules\/(.*)/)[1];
  const isNew = id === 'new';
  const rule = rules[id];

  const graphOptions = useMemo(() => {
    const list = Object.values(indexes)
      // .filter(i => !i.vectorStoreProvider)
      .map(i => ({
        label: i.name,
        value: i.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [indexes]);

  const targets = useMemo(() => {
    const mytargets = [emptyTarget];
    if (indexesLoaded) {
      if (indexIdValue) {
        const index = indexes[indexIdValue];
        if (index) {
          const { ontology, schema } = index;
          let ts = [];
          if (ontology) {
            const { edges, nodes } = ontology;
            if (nodes) {
              ts = [...edges, ...nodes].flatMap(({ data, type }) => {
                if (data) {
                  const { label, properties = [] } = data;
                  return properties.map(p => ({
                    target_id: label + '.' + p.property,
                    label: label + ': ' + humanize(p.property),
                    type_id: p.dataType,
                    attr_type: 'Features',
                  }));
                }
              });
            }
          } else if (schema?.properties) {
            const getTargets = (props, prefix) => {
              return Object.entries(props).flatMap(([k, v]) => {
                if (v.type === 'object') {
                  return getTargets(v.properties, prefix + '.' + k);
                }
                if (v.type === 'array') {
                  // TODO
                  return [];
                }
                const [nodelLabel, ...rest] = prefix.split('.');
                return {
                  target_id: prefix + '.' + k,
                  label: nodelLabel + ': ' + humanize(k),
                  type_id: v.type,
                  attr_type: 'Features',
                }
              });
            };

            ts = getTargets(schema.properties, index.nodeLabel);
          }
          mytargets.push(...ts);
        }
      }
    }
    return mytargets;
  }, [indexIdValue, indexesLoaded]);

  const targetValues = useMemo(() => {
    const values = {};
    if (graphsLoaded && indexesLoaded && indexIdValue && targets?.length) {
      const targetsMap = targets.reduce((a, t) => {
        a[t.target_id] = t;
        return a;
      }, {});
      if (indexIdValue) {
        const index = indexes[indexIdValue];
        if (index?.graphStoreProvider) {
          const g = graphs[index.name];
          if (g?.nodes?.length) {
            for (const el of [...(g.edges || []), ...g.nodes]) {
              const props = Object.entries(el.properties || {});
              for (const [key, val] of props) {
                const targetId = el.type + '.' + key;
                const target = targetsMap[targetId];
                if (target?.type_id === 'tag') {
                  if (!values[targetId]) {
                    values[targetId] = [];
                  }
                  values[targetId].push(val);
                }
              }
            }
          }
        }
      }
      setTargetValuesLoaded(true);
    }
    return values;
  }, [graphsLoaded, indexesLoaded, indexIdValue, targets]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Ruleset',
    }));
    if (!isNew) {
      dispatch(getRuleAsync(id));
    }
  }, []);

  useEffect(() => {
    if (indexesLoaded && indexIdValue) {
      const index = indexes[indexIdValue];
      if (index) {
        dispatch(getGraphAsync({
          graphStoreProvider: index.graphStoreProvider,
          indexName: index.name,
        }));
      }
    }
  }, [indexIdValue, indexesLoaded]);

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getIndexesAsync({ workspaceId: selectedWorkspace.id }));
    }
  }, [selectedWorkspace]);

  const onCancel = () => {
    navigate('/rules');
  };

  const onFinish = (values) => {
    console.log('values:', values);
    if (isNew) {
      dispatch(createRuleAsync({
        values: {
          ...values,
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      dispatch(updateRuleAsync({
        id,
        values: {
          ...rule,
          ...values,
        },
      }));
    }
    navigate('/rules');
  };

  // console.log('rule:', rule);
  // console.log('targets:', targets);
  // console.log('targetValues:', targetValues);

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <div style={{ marginTop: 20 }}>
      <Form
        {...layout}
        form={form}
        name="rule"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={rule}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter a name',
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Semantic Index/KG"
          name="indexId"
        >
          <LinkableSelect
            allowClear
            loading={indexesLoading}
            options={graphOptions}
            optionFilterProp="label"
            template="/indexes/{value}"
          />
        </Form.Item>
        <Form.Item
          label="Rulesets"
          name="rules"
        >
          <RulesInput
            targets={targets}
            targetValues={targetValues}
            targetValuesLoaded={targetValuesLoaded}
          />
        </Form.Item>
        <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 5 }}>
          <Space>
            <Button type="default" onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}

const LinkableSelect = ({ loading, onChange, options, template, value, ...props }) => {

  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex' }}>
      <Select
        {...props}
        loading={loading}
        options={options}
        onChange={onChange}
        value={value}
      />
      {value ?
        <Button
          type="link"
          icon={<LinkOutlined />}
          onClick={() => navigate(template.replace('{value}', String(value)))}
          style={{ width: 32 }}
        />
        : null
      }
    </div>
  );
};
