import React from 'react';
import { Modal, Typography, Space } from 'antd';
import dayjs from 'dayjs';

interface DraftResumeModalProps {
  open: boolean;
  lastSaved: string; // ISO timestamp
  onResume: () => void;
  onStartFresh: () => void;
}

const DraftResumeModal: React.FC<DraftResumeModalProps> = ({
  open,
  lastSaved,
  onResume,
  onStartFresh,
}) => (
  <Modal
    open={open}
    title="Resume Draft?"
    okText="Resume Draft"
    cancelText="Start Fresh"
    onOk={onResume}
    onCancel={onStartFresh}
    closable={false}
    maskClosable={false}
  >
    <Space direction="vertical" size="small">
      <Typography.Text>
        You have an unsaved draft from{' '}
        <strong>{dayjs(lastSaved).format('MMM D, YYYY h:mm A')}</strong>.
      </Typography.Text>
      <Typography.Text type="secondary">
        Would you like to resume where you left off, or start a new scenario
        from scratch?
      </Typography.Text>
    </Space>
  </Modal>
);

export default DraftResumeModal;
