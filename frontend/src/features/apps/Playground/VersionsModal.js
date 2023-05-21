import { useState } from 'react';
import { Empty, Modal, Radio, Space } from 'antd';

export function VersionsModal({
  handleCancel,
  onVersionRollback,
  isModalOpen,
  selectedRow,
}) {

  const [selectedVersion, setSelectedVersion] = useState(null);

  const handleVersionRollback = () => {
    onVersionRollback(selectedVersion);
  };

  const onChange = (ev) => {
    setSelectedVersion(ev.target.value);
  };

  return (
    <Modal
      title="Version History"
      okText="Rollback"
      okButtonProps={{
        disabled: !(selectedRow && selectedRow.versions && selectedVersion),
      }}
      open={isModalOpen}
      onOk={handleVersionRollback}
      onCancel={handleCancel}
    >
      {selectedRow?.versions ?
        <Radio.Group onChange={onChange} value={selectedVersion}>
          <Space direction="vertical">
            {selectedRow.versions.map((v) => (
              <Radio key={v.hash} value={v.hash}>{v.text}</Radio>
            ))}
          </Space>
        </Radio.Group>
        :
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      }
    </Modal>
  );
}