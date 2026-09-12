'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SolarBuilding } from '@/lib/campus-model';

export function ShadowInspector({
  building,
  onSave,
  onRedraw,
}: {
  building: SolarBuilding;
  onSave: (building: SolarBuilding) => void;
  onRedraw: () => void;
}) {
  const nameId = useId();
  const heightId = useId();
  const [name, setName] = useState(building.name);
  const [height, setHeight] = useState(String(building.heightMeters));
  const valid =
    name.trim() && Number.isFinite(Number(height)) && Number(height) > 0;
  return (
    <form
      className="shadow-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid)
          onSave({
            ...building,
            name: name.trim(),
            heightMeters: Number(height),
          });
      }}
    >
      <label className="field-label" htmlFor={nameId}>
        建筑名称
        <Input
          id={nameId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label className="field-label" htmlFor={heightId}>
        建筑高度（米）
        <Input
          id={heightId}
          type="number"
          min="0"
          step="any"
          value={height}
          onChange={(event) => setHeight(event.target.value)}
          required
        />
      </label>
      <p className="helper-text">
        阴影随太阳方向、时间和建筑高度计算，晴天用于少晒路线。
      </p>
      <Button size="sm" type="submit" disabled={!valid}>
        保存阴影属性
      </Button>
      <Button size="sm" type="button" variant="outline" onClick={onRedraw}>
        重画矩形
      </Button>
    </form>
  );
}
