import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Select } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official';
import * as dayjs from 'dayjs';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  getAnalyticsAsync,
  selectAnalytics,
  selectLoading,
} from './traceAnalyticsSlice';

export function TracesDashboard() {

  const [filter, setFilter] = useLocalStorageState('traces-filter', { defaultValue: {} });

  const analytics = useSelector(selectAnalytics);
  const loading = useSelector(selectLoading);

  // console.log('analytics:', analytics);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Usage',
    }));
    dispatch(getAnalyticsAsync({ workspaceId: selectedWorkspace.id }));
  }, []);

  const userOptions = useMemo(() => {
    if (analytics.requestsByUser) {
      let list = Object.values(analytics.requestsByUser)
        .map(Object.keys)
        .flat()
        .filter(v => v);
      list = [...new Set(list)];
      list.sort((a, b) => a < b ? -1 : 1);
      return list.map(u => ({
        label: u,
        value: u,
      }));
    }
    return [];
  }, [analytics]);

  const yearOptions = useMemo(() => {
    if (analytics.requestsByUser) {
      let list = Object.keys(analytics.requestsByUser)
        .map(d => dayjs(d).year());
      list = [...new Set(list)];
      list.sort((a, b) => a < b ? -1 : 1);
      return list.map(y => ({
        label: y,
        value: y,
      }));
    }
    return [];
  }, [analytics]);

  const monthOptions = useMemo(() => {
    if (analytics.requestsByUser) {
      let list = Object.keys(analytics.requestsByUser)
        .map(d => dayjs(d).month());
      list = [...new Set(list)];
      list.sort((a, b) => a < b ? -1 : 1);
      return list.map(m => ({
        label: m,
        value: m,
      }));
    }
    return [];
  }, [analytics]);

  const modelOptions = useMemo(() => {
    if (analytics.requestsByUser) {
      let list = Object.values(analytics.requestsByUser)
        .map(v => Object.values(v).map(Object.keys))
        .flat(Infinity);
      list = [...new Set(list)];
      list.sort((a, b) => a < b ? -1 : 1);
      return list.map(m => ({
        label: m,
        value: m,
      }));
    }
    return [];
  }, [analytics]);

  const getOptions = (property, tickInterval) => {
    if (analytics.requestsByUser && filter.year && filter.month) {
      const userData = Object.entries(analytics.requestsByUser)
        .filter(([k, _]) => {
          const date = dayjs(k);
          return date.year() === filter.year && date.month() === filter.month;
        })
        .reduce((a, [k, v]) => {
          const date = dayjs(k);
          if (filter.username) {
            if (filter.model) {
              a[date.date()] = v[filter.username]?.[filter.model]?.[property] || 0;
            } else {
              a[date.date()] = Object.entries(v[filter.username] || {})
                .reduce((b, [model, x]) => {
                  b[model] = x[property];
                  return b;
                }, {});
            }
          } else {
            if (filter.model) {
              a[date.date()] = Object.values(v)
                .reduce((b, x) => b + (x[filter.model]?.[property] || 0), 0);
            } else {
              const values = Object.values(v).reduce((b, x) => {
                for (const [model, y] of Object.entries(x)) {
                  b[model] = [y[property]];
                }
                return b;
              }, {});
              a[date.date()] = Object.entries(values)
                .reduce((b, [model, xs]) => {
                  b[model] = xs.reduce((c, x) => c + x, 0);
                  return b;
                }, {});
            }
          }
          return a;
        }, {});
      const daysInMonth = dayjs(`${filter.year}-${filter.month}-01`).daysInMonth();
      const categories = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const series = [];
      if (filter.model) {
        const data = [];
        for (let i = 1; i <= daysInMonth; i++) {
          data.push(userData[i] || 0);
        }
        series.push({ data });
      } else {
        let models = Object.values(userData)
          .map(Object.keys)
          .flat();
        models = [...new Set(models)];
        models.sort((a, b) => a < b ? -1 : 1);
        for (const model of models) {
          const data = [];
          for (let i = 1; i <= daysInMonth; i++) {
            data.push(userData[i]?.[model] || 0);
          }
          series.push({ name: model, data });
        }
      }
      return {
        chart: {
          type: 'column',
        },
        title: {
          text: 'Usage',
        },
        xAxis: {
          categories,
          accessibility: {
            description: 'Day',
          },
        },
        yAxis: {
          min: 0,
          title: {
            text: 'Number ' + property,
          },
          tickInterval,
        },
        tooltip: {
          format: '<b>{key}</b><br/>{series.name}: {y}<br/>' +
            'Total: {point.stackTotal}'
        },

        plotOptions: {
          column: {
            stacking: 'normal'
          }
        },
        series,
      };
    }
    return null;
  }

  const requestsOptions = useMemo(() => {
    return getOptions('requests', 1);
  }, [analytics, filter]);

  const tokensOptions = useMemo(() => {
    return getOptions('tokens', 1000);
  }, [analytics, filter]);

  if (loading) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    )
  }
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex' }}>
        <Button
          icon={<UnorderedListOutlined />}
          onClick={() => navigate('/traces')}
        >
          Listing
        </Button>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          <Form
            layout="inline"
            initialValues={filter}
            onValuesChange={(changes) => setFilter((cur) => ({ ...cur, ...changes }))}
          >
            <Form.Item
              label="Year"
              name="year"
            >
              <Select allowClear
                options={yearOptions}
                style={{ width: 100 }}
              />
            </Form.Item>
            <Form.Item
              label="Month"
              name="month"
            >
              <Select allowClear
                options={monthOptions}
                style={{ width: 100 }}
              />
            </Form.Item>
            <Form.Item
              label="Username"
              name="username"
            >
              <Select allowClear
                options={userOptions}
                style={{ width: 250 }}
              />
            </Form.Item>
            <Form.Item
              label="Model"
              name="model"
            >
              <Select allowClear
                options={modelOptions}
                style={{ width: 250 }}
              />
            </Form.Item>
          </Form>
        </div>
      </div>
      {requestsOptions ?
        <>
          <div style={{ marginTop: 20 }}>
            <HighchartsReact
              highcharts={Highcharts}
              options={requestsOptions}
            />
          </div>
          <div style={{ marginTop: 20 }}>
            <HighchartsReact
              highcharts={Highcharts}
              options={tokensOptions}
            />
          </div>
        </>
        :
        <div style={{ marginTop: 20 }}>
          Make selections...
        </div>
      }
    </div>
  );

}
