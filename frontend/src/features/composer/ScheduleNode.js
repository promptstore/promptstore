import { memo, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Handle, Position, useReactFlow, useStoreApi } from 'reactflow';
import * as dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { ScheduleModalInput } from '../../components/ScheduleModalInput';
import {
  pauseScheduleAsync,
  unpauseScheduleAsync,
  deleteScheduleAsync,
} from '../transformations/transformationsSlice';
import {
  updateCompositionAsync,
} from './compositionsSlice';

dayjs.extend(customParseFormat);

export default memo(({ id, data, isConnectable }) => {

  console.log('data:', data);

  const { setNodes } = useReactFlow();
  const store = useStoreApi();
  const dispatch = useDispatch();

  const schedule = useMemo(() => {
    if (data.schedule) {
      const schedule = data.schedule;
      return {
        ...schedule,
        startDate: schedule.startDate ? dayjs(schedule.startDate) : undefined,
        endDate: schedule.endDate ? dayjs(schedule.endDate) : undefined,
        startTime: schedule.startTime ? dayjs(schedule.startTime, 'HH:mm:ss') : undefined,
        endTime: schedule.endTime ? dayjs(schedule.endTime, 'HH:mm:ss') : undefined,
      };
    }
    return null;
  }, [data]);

  const onChange = (values) => {
    console.log('values:', values);
    const { nodeInternals } = store.getState();
    setNodes(
      Array.from(nodeInternals.values()).map((node) => {
        if (node.id === id) {
          const schedule = {
            ...values,
            startDate: values.startDate?.format('YYYY-MM-DD'),
            endDate: values.endDate?.format('YYYY-MM-DD'),
            startTime: values.startTime?.format('HH:mm:ss'),
            endTime: values.endTime?.format('HH:mm:ss'),
          };
          node.data = {
            ...node.data,
            schedule,
          };
        }
        return node;
      })
    );
  };

  const deleteSchedule = () => {
    const { scheduleId } = data;
    console.log('deleting schedule:', scheduleId);
    if (scheduleId) {
      dispatch(deleteScheduleAsync({ scheduleId }));
      dispatch(updateCompositionAsync({
        id: data.compositionId,
        values: {
          schedule: null,
          scheduleId: null,
          scheduleStatus: null,
        },
      }));
    }
  };

  const pauseSchedule = () => {
    const { scheduleId } = data;
    console.log('pausing schedule:', scheduleId);
    if (scheduleId) {
      dispatch(pauseScheduleAsync({ scheduleId }));
      dispatch(updateCompositionAsync({
        id: data.compositionId,
        values: {
          scheduleStatus: 'paused',
        },
      }));
    }
  };

  const unpauseSchedule = () => {
    const { scheduleId } = data;
    console.log('unpausing schedule:', scheduleId);
    if (scheduleId) {
      dispatch(unpauseScheduleAsync({ scheduleId }));
      dispatch(updateCompositionAsync({
        id: data.compositionId,
        values: {
          scheduleStatus: 'running',
        },
      }));
    }
  };

  return (
    <>
      <div className="custom-node__header">
        Schedule
      </div>
      <div className="custom-node__body">
        <div style={{ transform: 'scale(0.65) translate(-33px)' }}>
          <ScheduleModalInput
            iconControls={true}
            onChange={onChange}
            onDelete={deleteSchedule}
            onPause={pauseSchedule}
            onUnpause={unpauseSchedule}
            scheduleId={data.scheduleId}
            scheduleStatus={data.scheduleStatus}
            title="Set"
            value={schedule}
          />
        </div>
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </>
  );
});
