import { useState } from 'react';
import {
  Button,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Segmented,
  Space,
  Switch,
  TimePicker,
} from 'antd';
import { CheckOutlined } from '@ant-design/icons';

const layout = {
  wrapperCol: { span: 24 },
};

const frequencyOptions = [
  {
    label: 'Non-recurring',
    value: 'norepeat',
  },
  {
    label: 'Minutes',
    value: 'minute',
  },
  {
    label: 'Hourly',
    value: 'hour',
  },
  {
    label: 'Daily',
    value: 'day',
  },
  {
    label: 'Weekly',
    value: 'week',
  },
  {
    label: 'Monthly',
    value: 'month',
  },
  {
    label: 'Annually',
    value: 'year',
  },
];

const dayOfWeekOptions = [
  {
    label: 'S',
    value: 0,
  },
  {
    label: 'M',
    value: 1,
  },
  {
    label: 'T',
    value: 2,
  },
  {
    label: 'W',
    value: 3,
  },
  {
    label: 'T',
    value: 4,
  },
  {
    label: 'F',
    value: 5,
  },
  {
    label: 'S',
    value: 6,
  },
];

const endOptions = [
  {
    label: 'Never',
    value: 'never',
  },
  {
    label: 'On',
    value: 'on',
  },
  {
    label: 'After',
    value: 'after',
  },
];

export function ScheduleModalInput({
  buttonProps,
  onChange,
  title = 'Set Schedule',
  value,
  onPause,
  onUnpause,
  onDelete,
  scheduleId,
  scheduleStatus,
}) {

  const [isDirty, setIsDirty] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form] = Form.useForm();
  const frequencyValue = Form.useWatch('frequency', form);
  const endsValue = Form.useWatch('ends', form);
  const allDayValue = Form.useWatch('allDay', form);

  const handleClose = (ev) => {
    setIsModalOpen(false);
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    if (typeof onChange === 'function') {
      onChange(values);
    }
    setIsModalOpen(false);
  };

  const hasState = hasValue(value) || isDirty;

  return (
    <>
      <Modal
        onCancel={handleClose}
        onOk={handleOk}
        open={isModalOpen}
        title={title}
        width={600}
      >
        <Form
          {...layout}
          form={form}
          name="schedule"
          autoComplete="off"
          onChange={() => setIsDirty(true)}
          onFinish={handleOk}
          initialValues={value}
        >
          <Form.Item
            name="startDate"
            extra="Start date"
          >
            <DatePicker
              style={{ width: 214 }}
            />
          </Form.Item>
          <Form.Item
            name="frequency"
            extra="Frequency"
          >
            <Segmented
              options={frequencyOptions}
            />
          </Form.Item>
          {frequencyValue && frequencyValue !== 'norepeat' ?
            <>
              <div>
                <Space size="large">
                  <Form.Item
                    name="frequencyLength"
                    extra="Every"
                    style={{ width: 214 }}
                  >
                    <InputNumber suffix={`${frequencyValue}(s)`} />
                  </Form.Item>
                  {frequencyValue === 'week' ?
                    <Form.Item
                      name="frequencyDayOfWeek"
                      extra="Day of week"
                    >
                      <Segmented
                        options={dayOfWeekOptions}
                      />
                    </Form.Item>
                    : null
                  }
                </Space>
              </div>
              <div>
                <Space size="large">
                  <div style={{ width: 215 }}>
                    <Form.Item
                      name="ends"
                      extra="Ends"
                    >
                      <Segmented
                        options={endOptions}
                      />
                    </Form.Item>
                  </div>
                  {endsValue === 'on' ?
                    <Form.Item
                      name="endDate"
                      extra="End date"
                    >
                      <DatePicker
                        style={{ width: 214 }}
                      />
                    </Form.Item>
                    : null
                  }
                  {endsValue === 'after' ?
                    <Form.Item
                      name="afterLength"
                      extra="Length"
                      style={{ width: 214 }}
                    >
                      <InputNumber suffix="occurrence(s)" />
                    </Form.Item>
                    : null
                  }
                </Space>
              </div>
            </>
            : null
          }
          <div>
            <Space size="large">
              <Form.Item
                name="allDay"
                extra="All day"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              {!allDayValue ?
                <>
                  <Form.Item
                    name="startTime"
                    extra="Start time"
                  >
                    <TimePicker
                      style={{ width: 147 }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="endTime"
                    extra="End time"
                  >
                    <TimePicker
                      style={{ width: 147 }}
                    />
                  </Form.Item>
                </>
                : null
              }
            </Space>
          </div>
        </Form>
      </Modal>
      <Space>
        <Button
          icon={hasState ? <CheckOutlined /> : null}
          onClick={() => setIsModalOpen(true)}
          {...buttonProps}
        >
          {title}
        </Button>
        <Button
          disabled={!scheduleId || scheduleStatus === 'paused'}
          onClick={() => onPause()}
        >
          Pause
        </Button>
        <Button
          disabled={!scheduleId || scheduleStatus !== 'paused'}
          onClick={() => onUnpause()}
        >
          Unpause
        </Button>
        <Button
          disabled={!scheduleId}
          onClick={() => onDelete()}
        >
          Delete
        </Button>
      </Space>
    </>
  );
}

const hasValue = (value) => {
  if (!value) return false;
  return Object.values(value).some(v => !(v === null || typeof v === 'undefined'));
};