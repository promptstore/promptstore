import { useEffect, useState } from 'react';
import { Button, Col, Modal, Row } from 'antd';
import { CheckOutlined } from '@ant-design/icons';

export function DeploymentModalInput({
  buttonProps,
  implementations = [],
  models = [],
  onChange,
  title = 'Set Schema',
  value,
}) {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [state, setState] = useState(null);

  useEffect(() => {
    setState(value);
  }, [value]);

  const handleClose = (ev) => {
    setIsModalOpen(false);
    setState(value);
  };

  const handleOk = () => {
    if (typeof onChange === 'function') {
      onChange(state);
    }
    setIsModalOpen(false);
    setState(null);
  }



  return (
    <>
      <Modal
        onCancel={handleClose}
        onOk={handleOk}
        open={isModalOpen}
        title={title}
        width={'90%'}
      >
        {implementations.filter(impl => impl.modelId).map(impl => (
          <Row>
            <Col>
              {models[impl.modelId].key}
            </Col>
            <Col>
            </Col>
          </Row>
        ))}
      </Modal>
      <Button
        disabled={!implementations.length}
        icon={true ? null : <CheckOutlined />}
        onClick={() => setIsModalOpen(true)}
        {...buttonProps}
      >
        {title}
      </Button>
    </>
  );
}
