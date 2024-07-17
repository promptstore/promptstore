import { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Space } from 'antd';
import { CheckOutlined } from '@ant-design/icons';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  fixFunctionTagSettingsAsync,
  fixPromptSetTagSettingsAsync,
  fixSkillSettingsAsync,
  rebuildSearchIndexAsync,
  selectLoaded,
} from './adminFunctionsSlice';

export function AdminFunctions() {

  const [status, setStatus] = useState({});
  const [type, setType] = useState(null);

  const loaded = useSelector(selectLoaded);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Admin Functions',
    }));
  }, []);

  useEffect(() => {
    if (loaded && !status[type]) {
      setStatus(cur => ({ ...cur, [type]: true }));
      setType(null);
    }
  }, [loaded]);

  const handleFixFunctionTagSetting = () => {
    setType('FunctionTag');
    dispatch(fixFunctionTagSettingsAsync({ workspaceId: selectedWorkspace.id }));
  };

  const handleFixPromptSetTagSetting = () => {
    setType('PromptSetTag');
    dispatch(fixPromptSetTagSettingsAsync({ workspaceId: selectedWorkspace.id }));
  };

  const handleFixSkillSetting = () => {
    setType('Skill');
    dispatch(fixSkillSettingsAsync({ workspaceId: selectedWorkspace.id }));
  };

  const handleRebuildSearchIndex = () => {
    setType('SearchIndex');
    dispatch(rebuildSearchIndexAsync({ workspaceId: selectedWorkspace.id }));
  };

  return (
    <div style={{ marginTop: 20 }}>
      <Space direction="vertical">
        <Button
          icon={status['FunctionTag'] ? <CheckOutlined /> : null}
          onClick={handleFixFunctionTagSetting}
          style={{ width: 264, textAlign: 'left' }}
        >
          Fix Function Tag Setting
        </Button>
        <Button
          icon={status['PromptSetTag'] ? <CheckOutlined /> : null}
          onClick={handleFixPromptSetTagSetting}
          style={{ width: 264, textAlign: 'left' }}
        >
          Fix Prompt Template Tag Setting
        </Button>
        <Button
          icon={status['Skill'] ? <CheckOutlined /> : null}
          onClick={handleFixSkillSetting}
          style={{ width: 264, textAlign: 'left' }}
        >
          Fix Skill Setting
        </Button>
        <Button
          icon={status['SearchIndex'] ? <CheckOutlined /> : null}
          onClick={handleRebuildSearchIndex}
          style={{ width: 264, textAlign: 'left' }}
        >
          Rebuild Search Index
        </Button>
      </Space>
    </div>
  );
}