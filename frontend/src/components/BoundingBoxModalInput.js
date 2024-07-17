import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Cropper } from 'react-advanced-cropper';

export function BoundingBoxModalInput({
  imageUrl,
  onChange,
  value,
}) {

  const [isModalOpen, setIsModalOpen] = useState(false);

  const cropperRef = useRef();

  useEffect(() => {
    if (value?.width) {
      cropperRef.current.setCoordinates(value);
    }
  }, [value]);

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleOk = () => {
    const coordinates = cropperRef.current.getCoordinates();
    // console.log('coordinates:', coordinates);
    onChange(coordinates);
    setIsModalOpen(false);
  };

  const handleReset = () => {
    onChange(null);
  };

  return (
    <>
      <Modal
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={handleOk}
        okText="Set"
      >
        <Cropper
          ref={cropperRef}
          src={imageUrl}
          className="cropper"
        />
      </Modal>
      <Button
        icon={value?.width ? <CheckOutlined /> : null}
        onClick={() => setIsModalOpen(true)}
      >
        Set
      </Button>
      {value?.width ?
        <Button type="text"
          icon={<CloseOutlined />}
          onClick={handleReset}
        />
        : null
      }
    </>
  );
}