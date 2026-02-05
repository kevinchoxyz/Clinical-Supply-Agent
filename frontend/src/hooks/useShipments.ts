import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/shipments';
import type { ShipmentCreate, ShipmentAction } from '../types/shipment';

export const useShipments = (params?: { status?: string }) =>
  useQuery({ queryKey: ['shipments', params], queryFn: () => api.listShipments(params) });

export const useShipment = (id: string) =>
  useQuery({ queryKey: ['shipments', id], queryFn: () => api.getShipment(id), enabled: !!id });

export const useCreateShipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ShipmentCreate) => api.createShipment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
};

const useShipmentAction = (actionFn: (id: string, data?: ShipmentAction) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ShipmentAction }) => actionFn(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shipments'] }),
  });
};

export const useApproveShipment = () => useShipmentAction(api.approveShipment);
export const usePickShipment = () => useShipmentAction(api.pickShipment);
export const useShipShipment = () => useShipmentAction(api.shipShipment);
export const useReceiveShipment = () => useShipmentAction(api.receiveShipment);
