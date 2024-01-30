import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, DatePicker, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import * as dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { ScheduleModalInput } from '../../components/ScheduleModalInput';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getFunctionsAsync,
  selectFunctions,
  selectLoading as selectFunctionsLoading,
} from '../functions/functionsSlice';
import {
  getModelsAsync,
  selectModels,
  selectLoading as selectModelsLoading,
} from '../models/modelsSlice';
import {
  pauseScheduleAsync,
  unpauseScheduleAsync,
  deleteScheduleAsync,
} from '../transformations/transformationsSlice';

import {
  createEvaluationAsync,
  getEvaluationAsync,
  selectLoaded,
  selectEvaluations,
  updateEvaluationAsync,
} from './evaluationsSlice';

dayjs.extend(customParseFormat);

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const criteriaOptions = [
  {
    label: 'Conciseness',
    value: 'conciseness',
  },
  {
    label: 'Relevance',
    value: 'relevance',
  },
  {
    label: 'Correctness',
    value: 'correctness',
  },
  {
    label: 'Harmfulness',
    value: 'harmfulness',
  },
  {
    label: 'Maliciousness',
    value: 'maliciousness',
  },
  {
    label: 'Helpfulness',
    value: 'helpfulness',
  },
  {
    label: 'Controversiality',
    value: 'controversiality',
  },
  {
    label: 'Misogyny',
    value: 'misogyny',
  },
  {
    label: 'Criminality',
    value: 'criminality',
  },
  {
    label: 'Insensitivity',
    value: 'insensitivity',
  },
];

export function EvaluationForm() {

  const [backOnSave, setBackOnSave] = useState(false);

  const loaded = useSelector(selectLoaded);
  const evaluations = useSelector(selectEvaluations);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const functions = useSelector(selectFunctions);
  const modelsLoading = useSelector(selectModelsLoading);
  const models = useSelector(selectModels);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [form] = Form.useForm();

  // console.log('functions:', functions);

  const id = location.pathname.match(/\/evaluations\/(.*)/)[1];
  const isNew = id === 'new';

  const evaluation = useMemo(() => {
    const eval_ = evaluations[id];
    if (eval_) {
      const schedule = eval_.schedule || {};
      const [startDate, endDate] = eval_.dateRange || [null, null];
      const dateRange = [
        startDate ? dayjs(startDate) : null,
        endDate ? dayjs(endDate) : null
      ];
      return {
        ...eval_,
        dateRange,
        schedule: {
          ...schedule,
          startDate: schedule.startDate ? dayjs(schedule.startDate) : undefined,
          endDate: schedule.endDate ? dayjs(schedule.endDate) : undefined,
          startTime: schedule.startTime ? dayjs(schedule.startTime, 'HH:mm:ss') : undefined,
          endTime: schedule.endTime ? dayjs(schedule.endTime, 'HH:mm:ss') : undefined,
        },
      };
    }
    return null;
  }, [evaluations])

  const functionOptions = useMemo(() => {
    const list = Object.values(functions)
      .filter((func) => !func.tags?.includes('eval'))
      .map((func) => ({
        label: func.name,
        value: func.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [functions]);

  const evalFunctionOptions = useMemo(() => {
    const list = Object.values(functions)
      .filter((func) => func.tags?.includes('eval'))
      .map((func) => ({
        label: func.name,
        value: func.id,
      }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [functions]);

  const modelOptions = useMemo(() => {
    const list = Object.values(models).map(m => ({
      label: m.name,
      value: m.key,
    }));
    list.sort((a, b) => a.label < b.label ? -1 : 1);
    return list;
  }, [models]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Evaluation',
    }));
    if (!isNew) {
      dispatch(getEvaluationAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsAsync({ workspaceId }));
      dispatch(getModelsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (backOnSave) {
      setBackOnSave(false);
      navigate('/evaluations');
    }
  }, [evaluations]);

  const onCancel = () => {
    navigate('/evaluations');
  };

  const onFinish = (values) => {
    let schedule;
    if (values.schedule) {
      schedule = {
        ...values.schedule,
        startDate: values.schedule.startDate?.format('YYYY-MM-DD'),
        endDate: values.schedule.endDate?.format('YYYY-MM-DD'),
        startTime: values.schedule.startTime?.format('HH:mm:ss'),
        endTime: values.schedule.endTime?.format('HH:mm:ss'),
      };
    }
    if (isNew) {
      dispatch(createEvaluationAsync({
        values: {
          ...values,
          dateRange: [values.dateRange[0]?.format('YYYY-MM-DD'), values.dateRange[1]?.format('YYYY-MM-DD')],
          schedule,
          workspaceId: selectedWorkspace.id,
        },
      }));
    } else {
      dispatch(updateEvaluationAsync({
        id,
        values: {
          ...evaluation,
          ...values,
          dateRange: [values.dateRange[0]?.format('YYYY-MM-DD'), values.dateRange[1]?.format('YYYY-MM-DD')],
          schedule,
        },
      }));
    }
    setBackOnSave(true);
  };

  const pauseSchedule = () => {
    console.log('pausing schedule:', evaluation.scheduleId);
    if (evaluation.scheduleId) {
      dispatch(pauseScheduleAsync({ scheduleId: evaluation.scheduleId }));
      dispatch(updateEvaluationAsync({
        id,
        values: {
          ...evaluation,
          scheduleStatus: 'paused',
        },
      }));
    }
  };

  const unpauseSchedule = () => {
    console.log('unpausing schedule:', evaluation.scheduleId);
    if (evaluation.scheduleId) {
      dispatch(unpauseScheduleAsync({ scheduleId: evaluation.scheduleId }));
      dispatch(updateEvaluationAsync({
        id,
        values: {
          ...evaluation,
          scheduleStatus: 'running',
        },
      }));
    }
  };

  const deleteSchedule = () => {
    console.log('deleting schedule:', evaluation.scheduleId);
    if (evaluation.scheduleId) {
      dispatch(deleteScheduleAsync({ scheduleId: evaluation.scheduleId }));
      dispatch(updateEvaluationAsync({
        id,
        values: {
          ...evaluation,
          schedule: null,
          scheduleId: null,
          scheduleStatus: null,
        },
      }));
    }
  };

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
        name="evaluation"
        autoComplete="off"
        onFinish={onFinish}
        initialValues={evaluation}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            {
              required: true,
              message: 'Please enter an evaluation name',
            },
          ]}
          wrapperCol={{ span: 14 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
          wrapperCol={{ span: 14 }}
        >
          <TextArea autoSize={{ minRows: 3, maxRows: 14 }} />
        </Form.Item>
        <Form.Item
          label="Needs label"
          name="labelled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label="Selection"
          style={{ marginBottom: 0 }}
        >
          <Form.Item
            name="model"
            extra="Model"
            style={{ display: 'inline-block', marginRight: 16, width: 250 }}
          >
            <Select allowClear
              loading={modelsLoading}
              options={modelOptions}
            />
          </Form.Item>
          <Form.Item
            name="completionFunction"
            extra="Completion function"
            style={{ display: 'inline-block', marginRight: 16, width: 250 }}
          >
            <Select allowClear
              loading={functionsLoading}
              options={functionOptions}
            />
          </Form.Item>
          <Form.Item
            name="dateRange"
            extra="Dates"
            style={{ display: 'inline-block', marginRight: 16, width: 250 }}
          >
            <RangePicker />
          </Form.Item>
        </Form.Item>
        <Form.Item
          label="Evaluation"
          style={{ marginBottom: 0 }}
        >
          <Form.Item
            extra="Eval function"
            name="evalFunction"
            style={{ display: 'inline-block', marginRight: 16, width: 250 }}
          >
            <Select allowClear
              loading={functionsLoading}
              options={evalFunctionOptions}
            />
          </Form.Item>
          <Form.Item
            extra="Criterion"
            name="criteria"
            style={{ display: 'inline-block', marginRight: 16, width: 250 }}
          >
            <Select allowClear
              options={criteriaOptions}
            />
          </Form.Item>
          <Form.Item
            name="sampleSize"
            extra="Sample size"
            style={{ display: 'inline-block', marginRight: 16, width: 250 }}
          >
            <InputNumber />
          </Form.Item>
        </Form.Item>
        <Form.Item
          label="Schedule"
          name="schedule"
        >
          <ScheduleModalInput
            onPause={pauseSchedule}
            onUnpause={unpauseSchedule}
            onDelete={deleteSchedule}
            scheduleId={evaluation?.scheduleId}
            scheduleStatus={evaluation?.scheduleStatus}
          />
        </Form.Item>
        <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
          <Space>
            <Button type="default" onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
