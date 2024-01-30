import { useCallback, useEffect, useState } from 'react';
import { Button, InputNumber, Modal, Space } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import isEmpty from 'lodash.isempty';

export function ExperimentsModalInput({
  buttonProps,
  implementationsValue = [],
  models = [],
  onChange,
  title = 'Set Experiments',
  value,
}) {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (implementationsValue.length && value) {
      setState(implementationsValue.map((x, i) => ({ percentage: value?.[i]?.percentage })));
    }
  }, [implementationsValue, value]);

  const handleClose = (ev) => {
    setIsModalOpen(false);
    setError(null);
    setState(value);
  };

  const handleOk = () => {
    if (isEmpty(state) || !(implementationsValue.length > 1)) {
      handleClose();
      return;
    }
    const values = state.map((v) => {
      let percentage = +v.percentage;
      if (isNaN(percentage)) percentage = 0;
      return { ...v, percentage };
    });
    const sum = values.reduce((a, { percentage }) => a + percentage, 0);
    if (sum !== 100) {
      setError('Percentages must sum to 100');
      return;
    }
    if (typeof onChange === 'function') {
      onChange(values);
    }
    setIsModalOpen(false);
    setError(null);
    setState(null);
  }

  const noState = useCallback((val) => {
    if (isEmpty(val)) return true;
    return false;
  }, []);

  return (
    <>
      {isModalOpen ?
        <Modal
          onCancel={handleClose}
          onOk={handleOk}
          open={isModalOpen}
          title={title}
          width={800}
        >
          {implementationsValue.length > 1 ?
            <Space direction="vertical" size="large">
              <div>Use whole numbers</div>
              {implementationsValue.map((impl, i) =>
                <div key={'pct-' + i} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    {impl.modelId ? models[impl.modelId].key : 'Implementation ' + (i + 1)}
                  </div>
                  <div style={{ marginLeft: 24, width: 48 }}>
                    <InputNumber
                      value={state[i].percentage}
                      onChange={(ev) => {
                        setState((curr) => {
                          let newState = [...curr];
                          newState.splice(i, 1, { ...curr[i], percentage: ev.target.value });
                          return newState;
                        });
                      }}
                    />
                  </div>
                  <div style={{ marginLeft: 5 }}>%</div>
                </div>
              )}
              {error ?
                <div style={{ color: '#ff4d4f' }}>{error}</div>
                : null
              }
            </Space>
            :
            <div>Define two or more implementations</div>
          }
        </Modal>
        : null
      }
      <Button
        icon={noState(value) ? null : <CheckOutlined />}
        onClick={() => setIsModalOpen(true)}
        {...buttonProps}
      >
        {title}
      </Button>
    </>
  );
}
