import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Layout, Statistic, Table, Typography } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import * as dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official';

import { JsonView } from '../../components/JsonView';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { convertContentTypeToString, decodeEntities } from '../../utils';
import {
  getFunctionAsync,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  getTrainingDataByIdAsync,
  selectLoading as selectTrainingDataLoading,
  selectTrainingData,
} from '../training/trainingSlice';
import { formatPercentage } from '../../utils';

import {
  getEvaluationAsync,
  selectLoaded,
  selectLoading,
  selectEvaluations,
} from './evaluationsSlice';

dayjs.extend(customParseFormat);

const { Content, Sider } = Layout;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const criteriaOptions = [
  {
    label: 'Conciseness',
    value: 'conciseness',
  },
  {
    label: 'Relevance',
    value: 'relevance',
  },
  {
    label: 'Correctness',
    value: 'correctness',
  },
  {
    label: 'Harmfulness',
    value: 'harmfulness',
  },
  {
    label: 'Maliciousness',
    value: 'maliciousness',
  },
  {
    label: 'Helpfulness',
    value: 'helpfulness',
  },
  {
    label: 'Controversiality',
    value: 'controversiality',
  },
  {
    label: 'Misogyny',
    value: 'misogyny',
  },
  {
    label: 'Criminality',
    value: 'criminality',
  },
  {
    label: 'Insensitivity',
    value: 'insensitivity',
  },
];

export function EvaluationRuns() {

  const [selectedRun, setSelectedRun] = useState(null);

  const evaluations = useSelector(selectEvaluations);
  const loaded = useSelector(selectLoaded);
  const loading = useSelector(selectLoading);
  const functions = useSelector(selectFunctions);
  const trainingData = useSelector(selectTrainingData);
  const trainingDataLoading = useSelector(selectTrainingDataLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const id = location.pathname.match(/\/evaluation-runs\/(.*)/)[1];
  const evaluation = evaluations[id];

  // console.log('evaluation:', evaluation);

  const runs = useMemo(() => {
    if (evaluation?.runs) {
      const list = evaluation.runs.map((run, i) => ({
        key: i,
        runDate: run.runDate,
        numberTests: run.numberTests,
        percentPassed: run.percentPassed,
        allTestsPassed: run.allTestsPassed,
        numberFailed: run.numberFailed,
        embedding: run.embedding,
      }));
      list.sort((a, b) => a.runDate > b.runDate ? -1 : 1);
      return list;
    }
    return [];
  }, [evaluation]);

  const data = useMemo(() => {
    const list = Object.values(trainingData).map((row) => {
      const outputType = row.outputType;
      let response;
      if (outputType === 'function_call') {
        response = row.modelOutput.function_call;
      } else {
        response = row.modelOutputText;
      }
      return {
        key: row.id,
        prompt: row.modelInput,
        outputType,
        response,
        model: row.model,
        functionName: row.functionName,
      };
    });
    list.sort((a, b) => a.key > b.key ? 1 : -1);
    return list;
  }, [trainingData]);

  const criterion = useMemo(() => {
    if (evaluation) {
      const opt = criteriaOptions.find(o => o.value === evaluation.criteria);
      if (opt) {
        return opt.label;
      }
      return null;
    }
  }, [evaluation]);

  const dates = useMemo(() => {
    if (evaluation) {
      const [start, end] = evaluation.dateRange || [];
      if (start) {
        const startDate = dayjs(start).format('YYYY-MM-DD');
        if (end) {
          const endDate = dayjs(end).format('YYYY-MM-DD');
          return `${startDate} - ${endDate}`;
        }
        return `${startDate} -`;
      } else if (end) {
        const endDate = dayjs(end).format('YYYY-MM-DD');
        return `- ${endDate}`;
      }
      return null;
    }
  }, [evaluation]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Evaluation Runs',
    }));
    dispatch(getEvaluationAsync(id));
  }, []);

  useEffect(() => {
    if (evaluation) {
      if (evaluation.completionFunction) {
        dispatch(getFunctionAsync(evaluation.completionFunction));
      }
      if (evaluation.evalFunction) {
        dispatch(getFunctionAsync(evaluation.evalFunction));
      }
    }
  }, [evaluation]);

  useEffect(() => {
    if (runs.length) {
      setSelectedRun(runs[0]);
    }
  }, [runs]);

  useEffect(() => {
    if (selectedRun) {
      console.log('selected run:', selectedRun);
      const ids = (selectedRun.failed || []).map(r => r.logId);
      if (ids.length) {
        dispatch(getTrainingDataByIdAsync({ ids }));
      }
    }
  }, [selectedRun]);

  const openRun = (key) => {
    const run = runs.find(r => r.key === key);
    setSelectedRun(run);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: '70px',
      render: (_, { key }) => key,
    },
    {
      title: 'Prompt',
      dataIndex: 'prompt',
      className: 'top',
      render: (_, { prompt }) => (
        <Typography.Paragraph
          ellipsis={{ expandable: true, rows: 2 }}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {decodeEntities(convertContentTypeToString(prompt.messages[0].content).trim())}
        </Typography.Paragraph>
      ),
    },
    {
      title: 'Response',
      dataIndex: 'response',
      className: 'top',
      render: (_, { outputType, response }) => {
        if (outputType === 'function_call') {
          return <JsonView src={response} />;
        } else {
          return (
            <Typography.Paragraph
              ellipsis={{ expandable: true, rows: 2 }}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {response?.trim()}
            </Typography.Paragraph>
          );
        }
      },
    },
  ];

  const runColumns = [
    {
      title: 'Date',
      dataIndex: 'runDate',
      render: (_, { key, runDate }) => (
        <Link
          onClick={() => openRun(key)}
          style={{ whiteSpace: 'nowrap' }}
        >
          {dayjs(runDate).format('YYYY-MM-DD')}
        </Link>
      ),
    },
    {
      title: 'Tests',
      dataIndex: 'numberTests',
      align: 'right',
      render: (_, { numberTests }) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {numberFormatter.format(numberTests)}
        </div>
      ),
    },
    {
      title: 'Pass Rate',
      dataIndex: 'percentPassed',
      align: 'right',
      render: (_, { percentPassed }) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {formatPercentage(percentPassed)}
        </div>
      ),
    },
  ];

  const chartOptions = useMemo(() => {
    if (selectedRun?.embedding) {
      const yMax = Math.ceil(selectedRun.embedding.map(e => Math.abs(e[0])).reduce((a, x) => Math.max(a, x), 0)) + 2;
      const xMax = Math.ceil(selectedRun.embedding.map(e => Math.abs(e[1])).reduce((a, x) => Math.max(a, x), 0)) + 2;
      const series = [{ data: selectedRun.embedding }];
      // console.log('series:', series);
      return {
        chart: {
          type: 'scatter',
          zoomType: 'xy',
        },
        title: {
          text: 'Response Embedding Clusters',
        },
        xAxis: {
          min: -xMax,
          max: xMax,
        },
        yAxis: {
          min: -yMax,
          max: yMax,
        },
        legend: false,
        plotOptions: {
          scatter: {
            marker: {
              radius: 2.5,
              symbol: 'circle',
              states: {
                hover: {
                  enabled: true,
                  lineColor: 'rgb(100,100,100)'
                }
              }
            },
            states: {
              hover: {
                marker: {
                  enabled: false
                }
              }
            },
            jitter: {
              x: 0.005
            }
          }
        },
        tooltip: {
          pointFormatter: function () {
            let point = this;
            const numberFormatter = new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4,
            });
            return `${numberFormatter.format(point.x)}, ${numberFormatter.format(point.y)}`;
          },
        },
        series,
      };
    }
    return null;
  }, [selectedRun]);

  // console.log('runs:', runs);
  // console.log('selectedRun:', selectedRun);

  if (!loaded) {
    return <div style={{ marginTop: 20 }}>Loading...</div>
  }
  return (
    <div style={{ marginTop: 20 }}>
      <Descriptions title="Data Selection Criteria">
        {evaluation.model ?
          <Descriptions.Item label="Model">
            {evaluation.model}
          </Descriptions.Item>
          : null
        }
        {evaluation.completionFunction ?
          <Descriptions.Item label="Completion function">
            {functions?.[evaluation.completionFunction]?.name}
          </Descriptions.Item>
          : null
        }
        {dates ?
          <Descriptions.Item label="Dates">
            {dates}
          </Descriptions.Item>
          : null
        }
      </Descriptions>
      <Descriptions title="Evaluation Parameters">
        {evaluation.evalFunction ?
          <Descriptions.Item label="Evaluation function">
            {functions?.[evaluation.evalFunction]?.name}
          </Descriptions.Item>
          : null
        }
        <Descriptions.Item label="Criterion">
          {criterion}
        </Descriptions.Item>
      </Descriptions>
      <Descriptions title="Runs" />
      <Layout>
        <Sider
          style={{ height: '100%', marginRight: 20 }}
          width={300}
          theme="light"
        >
          <Table
            columns={runColumns}
            dataSource={runs}
            loading={loading}
            pagination={false}
          />
        </Sider>
        <Content>
          {selectedRun ?
            <>
              <Typography.Title level={2}>
                {dayjs(selectedRun.runDate).format('YYYY-MM-DD HH:mm:ss')}
              </Typography.Title>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <Card style={{ width: 155 }}>
                  <Statistic
                    title="All tests passed"
                    value=" "
                    prefix={selectedRun.allTestsPassed ? <CheckOutlined /> : <CloseOutlined />}
                  />
                </Card>
                <Card style={{ width: 155 }}>
                  <Statistic
                    title="Number of tests"
                    value={selectedRun.numberTests}
                  />
                </Card>
                <Card style={{ width: 155 }}>
                  <Statistic
                    title="Pass Rate"
                    value={formatPercentage(selectedRun.percentPassed)}
                  />
                </Card>
                {!selectedRun.allTestsPassed ?
                  <Card style={{ width: 155 }}>
                    <Statistic
                      title="Number failed"
                      value={selectedRun.numberFailed}
                    />
                  </Card>
                  : null
                }
              </div>
              {!selectedRun.allTestsPassed ?
                <Table
                  columns={columns}
                  dataSource={data}
                  loading={trainingDataLoading}
                  pagination={false}
                />
                : null
              }
              {selectedRun.embedding ?
                <div style={{ marginTop: 20, width: 667, height: 400 }}>
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={chartOptions}
                  />
                </div>
                : null
              }
            </>
            : null
          }
        </Content>
      </Layout>
    </div>
  );
}

const numberFormatter = new Intl.NumberFormat('en-US');
