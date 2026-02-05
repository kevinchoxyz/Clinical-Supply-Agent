import React from 'react';
import { Timeline, Typography, Space } from 'antd';
import dayjs from 'dayjs';

import type { ScenarioVersion } from '../../../types/scenario';

interface VersionTimelineProps {
  versions: ScenarioVersion[];
  latestVersion?: number;
  renderActions?: (version: ScenarioVersion) => React.ReactNode;
}

const VersionTimeline: React.FC<VersionTimelineProps> = ({
  versions,
  latestVersion,
  renderActions,
}) => {
  // Sort versions descending so the newest appears first
  const sorted = [...versions].sort((a, b) => b.version - a.version);

  const items = sorted.map((v) => {
    const isLatest = v.version === latestVersion;

    return {
      key: v.id,
      color: isLatest ? 'blue' : 'gray',
      children: (
        <div>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Space size="middle" align="baseline">
              <Typography.Text strong>
                v{v.version}
              </Typography.Text>
              {v.label && (
                <Typography.Text type="secondary">{v.label}</Typography.Text>
              )}
              {isLatest && (
                <Typography.Text
                  style={{
                    fontSize: 11,
                    color: '#1677ff',
                    border: '1px solid #1677ff',
                    borderRadius: 4,
                    padding: '0 6px',
                  }}
                >
                  latest
                </Typography.Text>
              )}
            </Space>

            <Space size="large">
              {v.created_by && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  by {v.created_by}
                </Typography.Text>
              )}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(v.created_at).format('YYYY-MM-DD HH:mm')}
              </Typography.Text>
              <Typography.Text code style={{ fontSize: 11 }}>
                {v.payload_hash.slice(0, 8)}
              </Typography.Text>
            </Space>

            {renderActions && <div style={{ marginTop: 4 }}>{renderActions(v)}</div>}
          </Space>
        </div>
      ),
    };
  });

  return <Timeline items={items} />;
};

export default VersionTimeline;
