import React from 'react';
import {
  Card,
  Select,
  Input,
  InputNumber,
  Button,
  Space,
  Form,
  Divider,
  Table,
  Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type {
  DispenseRule,
  DispenseRuleBody,
  DispenseCondition,
  DispenseConditionBranch,
  DispenseItem,
  Product,
} from '../../../types/scenario';

interface DispenseRuleEditorProps {
  rule: DispenseRule;
  products: Product[];
  onChange: (updated: DispenseRule) => void;
  onRemove: () => void;
}

const OP_OPTIONS = [
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
];

const emptyItem = (): DispenseItem => ({
  product_id: '',
  presentation_id: undefined,
  qty: 1,
  calc: undefined,
  notes: undefined,
});

const emptyCondition = (): DispenseCondition => ({
  field: 'dose_mcg',
  op: '<',
  value: 0,
});

const emptyBranch = (): DispenseConditionBranch => ({
  if: [emptyCondition()],
  then: { dispense: [emptyItem()] },
});

/* ------------------------------------------------------------------ */
/*  Sub-component: Dispense Items table                                */
/* ------------------------------------------------------------------ */
const DispenseItemsTable: React.FC<{
  items: DispenseItem[];
  products: Product[];
  onChange: (items: DispenseItem[]) => void;
}> = ({ items, products, onChange }) => {
  const productOptions = products.map((p) => ({
    value: p.product_id,
    label: p.name ? `${p.product_id} (${p.name})` : p.product_id,
  }));

  const getPresentationOptions = (productId: string) => {
    const prod = products.find((p) => p.product_id === productId);
    return (prod?.presentations ?? []).map((pr) => ({
      value: pr.presentation_id,
      label: pr.presentation_id,
    }));
  };

  const update = (idx: number, partial: Partial<DispenseItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...partial };
    onChange(next);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, emptyItem()]);

  return (
    <>
      <Table
        size="small"
        pagination={false}
        dataSource={items.map((it, i) => ({ ...it, _idx: i }))}
        rowKey="_idx"
        columns={[
          {
            title: 'Product',
            dataIndex: 'product_id',
            width: 180,
            render: (val: string, rec: DispenseItem & { _idx: number }) => (
              <Select
                value={val || undefined}
                onChange={(v) => update(rec._idx, { product_id: v, presentation_id: undefined })}
                size="small"
                style={{ width: '100%' }}
                options={productOptions}
                placeholder="Select"
                showSearch
              />
            ),
          },
          {
            title: 'Presentation',
            dataIndex: 'presentation_id',
            width: 160,
            render: (val: string | undefined, rec: DispenseItem & { _idx: number }) => (
              <Select
                value={val || undefined}
                onChange={(v) => update(rec._idx, { presentation_id: v })}
                size="small"
                style={{ width: '100%' }}
                options={getPresentationOptions(rec.product_id)}
                placeholder="Select"
                allowClear
                showSearch
              />
            ),
          },
          {
            title: 'Qty',
            dataIndex: 'qty',
            width: 80,
            render: (val: number | undefined, rec: DispenseItem & { _idx: number }) => (
              <InputNumber
                value={rec.calc ? undefined : val}
                disabled={!!rec.calc}
                min={0}
                step={1}
                onChange={(v) => update(rec._idx, { qty: v ?? undefined })}
                size="small"
                style={{ width: '100%' }}
                placeholder={rec.calc ? 'calc' : '1'}
              />
            ),
          },
          {
            title: 'Calc Expression',
            dataIndex: 'calc',
            width: 200,
            render: (val: string | undefined, rec: DispenseItem & { _idx: number }) => (
              <Input
                value={val ?? ''}
                onChange={(e) => {
                  const c = e.target.value || undefined;
                  update(rec._idx, { calc: c, qty: c ? undefined : rec.qty ?? 1 });
                }}
                size="small"
                placeholder="e.g. ceil(dose_mcg / 1000)"
              />
            ),
          },
          {
            title: 'Notes',
            dataIndex: 'notes',
            render: (val: string | undefined, rec: DispenseItem & { _idx: number }) => (
              <Input
                value={val ?? ''}
                onChange={(e) => update(rec._idx, { notes: e.target.value || undefined })}
                size="small"
                placeholder="Optional"
              />
            ),
          },
          {
            title: '',
            width: 40,
            render: (_: unknown, rec: DispenseItem & { _idx: number }) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => remove(rec._idx)}
                disabled={items.length <= 1}
              />
            ),
          },
        ]}
      />
      <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={add} style={{ marginTop: 4 }}>
        Add Item
      </Button>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Editor                                                        */
/* ------------------------------------------------------------------ */
const DispenseRuleEditor: React.FC<DispenseRuleEditorProps> = ({
  rule,
  products,
  onChange,
  onRemove,
}) => {
  const ruleBody: DispenseRuleBody = rule.rule ?? { type: 'conditional' };
  const ruleType = ruleBody.type ?? 'conditional';

  const updateBody = (partial: Partial<DispenseRuleBody>) => {
    onChange({ ...rule, rule: { ...ruleBody, ...partial } });
  };

  const setRuleType = (type: string) => {
    if (type === 'vial_optimization') {
      onChange({
        ...rule,
        rule: {
          type: 'vial_optimization',
          product_id: ruleBody.product_id ?? '',
          allowed_presentations: ruleBody.allowed_presentations ?? [],
          dose_uom: ruleBody.dose_uom ?? 'mg',
        },
      });
    } else {
      onChange({
        ...rule,
        rule: {
          type: 'conditional',
          conditions: ruleBody.conditions ?? [],
          default: ruleBody.default ?? { dispense: [emptyItem()] },
        },
      });
    }
  };

  /* -- Condition branch helpers -- */
  const conditions = ruleBody.conditions ?? [];

  const updateBranch = (idx: number, branch: DispenseConditionBranch) => {
    const next = [...conditions];
    next[idx] = branch;
    updateBody({ conditions: next });
  };

  const removeBranch = (idx: number) => {
    updateBody({ conditions: conditions.filter((_, i) => i !== idx) });
  };

  const addBranch = () => {
    updateBody({ conditions: [...conditions, emptyBranch()] });
  };

  /** Update a single condition within a branch's `if` array */
  const updateCondInBranch = (
    branchIdx: number,
    condIdx: number,
    partial: Partial<DispenseCondition>,
  ) => {
    const branch = conditions[branchIdx];
    const conds = [...branch.if];
    conds[condIdx] = { ...conds[condIdx], ...partial };
    updateBranch(branchIdx, { ...branch, if: conds });
  };

  const addCondToBranch = (branchIdx: number) => {
    const branch = conditions[branchIdx];
    updateBranch(branchIdx, { ...branch, if: [...branch.if, emptyCondition()] });
  };

  const removeCondFromBranch = (branchIdx: number, condIdx: number) => {
    const branch = conditions[branchIdx];
    updateBranch(branchIdx, {
      ...branch,
      if: branch.if.filter((_, i) => i !== condIdx),
    });
  };

  /* -- Default block helpers -- */
  const defaultBlock = ruleBody.default ?? { dispense: [emptyItem()] };

  const updateDefaultItems = (items: DispenseItem[]) => {
    updateBody({ default: { dispense: items } });
  };

  /* -- Product options for vial_optimization -- */
  const productOptions = products.map((p) => ({
    value: p.product_id,
    label: p.name ? `${p.product_id} (${p.name})` : p.product_id,
  }));

  const selectedProduct = products.find((p) => p.product_id === ruleBody.product_id);
  const presentationOptions = (selectedProduct?.presentations ?? []).map((pr) => ({
    value: pr.presentation_id,
    label: pr.presentation_id,
  }));

  return (
    <Card
      size="small"
      type="inner"
      title={rule.name ? `${rule.dispense_rule_id} — ${rule.name}` : rule.dispense_rule_id}
      style={{ marginBottom: 16 }}
      extra={
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={onRemove} />
      }
    >
      {/* Header: ID, Name, Type */}
      <Space wrap style={{ marginBottom: 12 }}>
        <Form.Item label="Rule ID" style={{ margin: 0 }}>
          <Input
            value={rule.dispense_rule_id}
            onChange={(e) => onChange({ ...rule, dispense_rule_id: e.target.value })}
            size="small"
            placeholder="e.g. DISP_DRUG_A"
            style={{ width: 160 }}
          />
        </Form.Item>
        <Form.Item label="Name" style={{ margin: 0 }}>
          <Input
            value={rule.name ?? ''}
            onChange={(e) => onChange({ ...rule, name: e.target.value })}
            size="small"
            placeholder="e.g. Drug A SC Injection"
            style={{ width: 220 }}
          />
        </Form.Item>
        <Form.Item label="Rule Type" style={{ margin: 0 }}>
          <Select
            value={ruleType}
            onChange={setRuleType}
            size="small"
            style={{ width: 170 }}
            options={[
              { value: 'conditional', label: 'Conditional' },
              { value: 'vial_optimization', label: 'Vial Optimization' },
            ]}
          />
        </Form.Item>
      </Space>

      {/* ---- Conditional rule body ---- */}
      {ruleType === 'conditional' && (
        <>
          {conditions.map((branch, bi) => (
            <Card
              key={bi}
              size="small"
              style={{ marginBottom: 8, background: '#fafafa' }}
              title={<Typography.Text strong style={{ fontSize: 12 }}>Branch {bi + 1}</Typography.Text>}
              extra={
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeBranch(bi)}
                />
              }
            >
              {/* Condition rows (AND logic) */}
              {branch.if.map((cond, ci) => (
                <Space key={ci} size="small" align="center" style={{ marginBottom: 6 }}>
                  <Typography.Text strong style={{ fontSize: 12, width: 30 }}>
                    {ci === 0 ? 'IF' : 'AND'}
                  </Typography.Text>
                  <Select
                    value={cond.field ?? 'dose_mcg'}
                    onChange={(v) => updateCondInBranch(bi, ci, { field: v })}
                    size="small"
                    style={{ width: 120 }}
                    options={[
                      { value: 'dose_mcg', label: 'dose_mcg' },
                      { value: 'dose_mg', label: 'dose_mg' },
                      { value: 'weight_kg', label: 'weight_kg' },
                    ]}
                  />
                  <Select
                    value={cond.op ?? '<'}
                    onChange={(v) => updateCondInBranch(bi, ci, { op: v })}
                    size="small"
                    style={{ width: 70 }}
                    options={OP_OPTIONS}
                  />
                  <InputNumber
                    value={cond.value}
                    onChange={(v) => updateCondInBranch(bi, ci, { value: v ?? 0 })}
                    size="small"
                    style={{ width: 100 }}
                    placeholder="value"
                  />
                  {branch.if.length > 1 && (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeCondFromBranch(bi, ci)}
                    />
                  )}
                </Space>
              ))}
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => addCondToBranch(bi)}
                style={{ padding: 0, marginBottom: 8 }}
              >
                Add AND condition
              </Button>

              <Divider orientation="left" plain style={{ margin: '4px 0 8px' }}>
                <Typography.Text strong style={{ fontSize: 12 }}>THEN dispense:</Typography.Text>
              </Divider>
              <DispenseItemsTable
                items={branch.then.dispense}
                products={products}
                onChange={(items) =>
                  updateBranch(bi, { ...branch, then: { dispense: items } })
                }
              />
            </Card>
          ))}

          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={addBranch}
            style={{ marginBottom: 12 }}
          >
            Add Condition Branch
          </Button>

          <Divider orientation="left" plain style={{ margin: '4px 0 8px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Default (when no conditions match)
            </Typography.Text>
          </Divider>
          <DispenseItemsTable
            items={defaultBlock.dispense}
            products={products}
            onChange={updateDefaultItems}
          />
        </>
      )}

      {/* ---- Vial optimization rule body ---- */}
      {ruleType === 'vial_optimization' && (
        <Space wrap>
          <Form.Item label="Product" style={{ margin: 0 }}>
            <Select
              value={ruleBody.product_id || undefined}
              onChange={(v) => updateBody({ product_id: v, allowed_presentations: [] })}
              size="small"
              style={{ width: 200 }}
              options={productOptions}
              placeholder="Select product"
              showSearch
            />
          </Form.Item>
          <Form.Item label="Allowed Presentations" style={{ margin: 0 }}>
            <Select
              mode="multiple"
              value={ruleBody.allowed_presentations ?? []}
              onChange={(v) => updateBody({ allowed_presentations: v })}
              size="small"
              style={{ minWidth: 200 }}
              options={presentationOptions}
              placeholder="Select presentations"
            />
          </Form.Item>
          <Form.Item label="Dose UOM" style={{ margin: 0 }}>
            <Select
              value={ruleBody.dose_uom ?? 'mg'}
              onChange={(v) => updateBody({ dose_uom: v })}
              size="small"
              style={{ width: 100 }}
              options={[
                { value: 'mg', label: 'mg' },
                { value: 'mcg', label: 'mcg' },
                { value: 'mL', label: 'mL' },
              ]}
            />
          </Form.Item>
        </Space>
      )}
    </Card>
  );
};

export default DispenseRuleEditor;
