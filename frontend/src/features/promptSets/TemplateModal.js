import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Modal, Select } from 'antd';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getTemplatesAsync,
  selectLoading,
  selectTemplates,
} from './templatesSlice';

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

export function TemplateModal({
  onCancel,
  onSubmit,
  open,
  width = 520,
}) {

  const loading = useSelector(selectLoading);
  const templates = useSelector(selectTemplates);

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  const [form] = Form.useForm();
  const templateIdValue = Form.useWatch('templateId', form);

  const options = useMemo(() => Object.values(templates).map((t) => ({
    label: t.name,
    value: t.id,
  })));

  useEffect(() => {
    dispatch(getTemplatesAsync(selectedWorkspace.id));
  }, []);

  const onOk = async () => {
    const values = await form.validateFields();
    const template = templates[values.templateId];
    onSubmit(template);
  };

  return (
    <Modal
      title="Use Template"
      okText="Use"
      okButtonProps={{
        disabled: !templateIdValue,
      }}
      onCancel={onCancel}
      onOk={onOk}
      open={open}
      width={width}
    >
      <Form
        {...layout}
        form={form}
      >
        <Form.Item
          label="Choose"
          name="templateId"
        >
          <Select allowClear
            loading={loading}
            options={options}
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}