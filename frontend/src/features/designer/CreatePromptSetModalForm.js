import { useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Divider, Form, Input, Modal, Select, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  createSettingAsync,
  getSettingsAsync,
  selectSettings,
  updateSettingAsync,
} from '../promptSets/settingsSlice';

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 24 },
};

export function CreatePromptSetModalForm({ open, onOk, onCancel }) {

  const [newSkill, setNewSkill] = useState('');
  const [skills, setSkills] = useState([]);

  const newSkillInputRef = useRef(null);

  const settings = useSelector(selectSettings);

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const [form] = Form.useForm();
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedWorkspace) {
      dispatch(getSettingsAsync({
        workspaceId: selectedWorkspace.id,
        key: 'skills',
      }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const skillsSetting = Object.values(settings).find(s => s.key === 'skills');
    if (skillsSetting) {
      setSkills(skillsSetting.value || []);
    }
  }, [settings]);

  const handleCancel = () => {
    onCancel();
    form.resetFields();
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    onOk(values);
    form.resetFields();
  };

  const skillOptions = skills.map((skill) => ({
    label: skill,
    value: skill,
  }));

  const addNewSkill = (ev) => {
    ev.preventDefault();
    if (newSkill && selectedWorkspace) {
      const newSkills = [...skills, newSkill];
      setSkills(newSkills);
      setNewSkill('');
      const setting = Object.values(settings).find(s => s.key === 'skills');
      const values = {
        workspaceId: selectedWorkspace.id,
        key: 'skills',
        value: newSkills,
      };
      if (setting) {
        dispatch(updateSettingAsync({ id: setting.id, values }));
      } else {
        dispatch(createSettingAsync({ values }));
      }
    }
    setTimeout(() => {
      newSkillInputRef.current?.focus();
    }, 0);
  };

  const onNewSkillChange = (ev) => {
    setNewSkill(ev.target.value);
  };

  return (
    <Modal
      title="New Prompt"
      okText="Create"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
      mask={false}
    >
      <Form
        {...layout}
        form={form}
        name="promptDesign"
        autoComplete="off"
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
          label="Skill"
          name="skill"
          rules={[
            {
              required: true,
              message: 'Please select a type',
            },
          ]}
        >
          <Select
            options={skillOptions}
            optionFilterProp="label"
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Space style={{ padding: '0 8px 4px' }}>
                  <Input
                    placeholder="Please enter new skill"
                    ref={newSkillInputRef}
                    value={newSkill}
                    onChange={onNewSkillChange}
                  />
                  <Button type="text" icon={<PlusOutlined />} onClick={addNewSkill}>
                    Add skill
                  </Button>
                </Space>
              </>
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};