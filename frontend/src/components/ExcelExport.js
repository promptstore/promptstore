import React from 'react';
import { Button, Tooltip } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';

const ExcelExport = ({ data, filename, buttonType = 'text', disabled = false }) => {

  const exportToExcel = () => {
    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `${filename}.xlsx`);
  };

  return (
    <Tooltip arrow title="Export to Excel" placement="left">
      <Button
        icon={<FileExcelOutlined />}
        onClick={exportToExcel}
        style={{ zIndex: 100 }}
        type={buttonType}
        disabled={disabled}
      />
    </Tooltip>
  );
}

export default ExcelExport;