import { useState } from 'react';
import { Empty, Modal, Radio, Space } from 'antd';
import * as dayjs from 'dayjs';

export function VersionsModal({
  handleCancel,
  onVersionRollback,
  isModalOpen,
  selectedRow,
  width = 520,
  keyProp = 'hash',
  valueProp = 'hash',
  titleProp = 'text',
}) {

  const [selectedVersion, setSelectedVersion] = useState(null);

  const handleVersionRollback = () => {
    onVersionRollback(selectedVersion);
  };

  const onChange = (ev) => {
    setSelectedVersion(ev.target.value);
  };

  const versions = [...(selectedRow?.versions || [])];
  versions.sort((a, b) => a.created < b.created ? 1 : -1);

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
      width={width}
    >
      {versions.length ?
        <Radio.Group onChange={onChange} value={selectedVersion}>
          <Space direction="vertical">
            {versions.map((v) => (
              <Radio key={v[keyProp]} value={v[valueProp]}>{v[titleProp]} - {dayjs(v.created).format('YYYY-MM-DD HH:mm')}</Radio>
            ))}
          </Space>
        </Radio.Group>
        :
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      }
    </Modal>
  );
}