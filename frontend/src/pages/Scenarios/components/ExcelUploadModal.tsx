import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Table,
  Radio,
  Button,
  Alert,
  Space,
  Typography,
} from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ParseResult } from '../../../utils/excelParser';

const { Dragger } = Upload;

interface ExcelUploadModalProps<T> {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (data: T[], mode: 'replace' | 'append') => void;
  parseFn: (file: File) => Promise<ParseResult<T>>;
  columns: ColumnsType<T>;
  onDownloadTemplate: () => void;
}

function ExcelUploadModal<T extends object>({
  open,
  title,
  onCancel,
  onConfirm,
  parseFn,
  columns,
  onDownloadTemplate,
}: ExcelUploadModalProps<T>) {
  const [parseResult, setParseResult] = useState<ParseResult<T> | null>(null);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [parsing, setParsing] = useState(false);

  const reset = () => {
    setParseResult(null);
    setMode('replace');
    setParsing(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = () => {
    if (parseResult && parseResult.errors.length === 0) {
      onConfirm(parseResult.data, mode);
      reset();
    }
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const result = await parseFn(file);
      setParseResult(result);
    } catch {
      setParseResult({
        data: [],
        errors: ['Failed to parse file. Ensure it is a valid .xlsx file.'],
        warnings: [],
      });
    } finally {
      setParsing(false);
    }
  };

  const hasErrors = (parseResult?.errors.length ?? 0) > 0;

  return (
    <Modal
      open={open}
      title={title}
      width={800}
      onCancel={handleCancel}
      footer={
        parseResult ? (
          <Space>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleConfirm}
              disabled={hasErrors || parseResult.data.length === 0}
            >
              Confirm Import
            </Button>
          </Space>
        ) : null
      }
    >
      {!parseResult ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={onDownloadTemplate}
            size="small"
          >
            Download Template
          </Button>

          <Dragger
            accept=".xlsx,.xls"
            multiple={false}
            showUploadList={false}
            beforeUpload={(file) => {
              handleFile(file as unknown as File);
              return false; // prevent auto-upload
            }}
            disabled={parsing}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag an Excel file here
            </p>
            <p className="ant-upload-hint">
              Supports .xlsx format. Download the template above for the
              expected column format.
            </p>
          </Dragger>
        </Space>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {parseResult.errors.map((err, i) => (
            <Alert key={`e-${i}`} type="error" message={err} showIcon />
          ))}
          {parseResult.warnings.map((warn, i) => (
            <Alert key={`w-${i}`} type="warning" message={warn} showIcon />
          ))}

          {parseResult.data.length > 0 && (
            <>
              <Typography.Text strong>
                Preview ({parseResult.data.length} rows)
              </Typography.Text>
              <Table
                size="small"
                pagination={parseResult.data.length > 10 ? { pageSize: 10 } : false}
                dataSource={parseResult.data.map((row, i) => ({
                  ...row,
                  _key: i,
                }))}
                rowKey="_key"
                columns={columns}
                scroll={{ x: 'max-content' }}
              />

              <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
                <Radio value="replace">Replace existing data</Radio>
                <Radio value="append">Append to existing data</Radio>
              </Radio.Group>
            </>
          )}

          {parseResult.data.length === 0 && parseResult.errors.length === 0 && (
            <Alert type="info" message="No data rows found in the file." showIcon />
          )}

          <Button size="small" onClick={reset}>
            Upload a different file
          </Button>
        </Space>
      )}
    </Modal>
  );
}

export default ExcelUploadModal;
