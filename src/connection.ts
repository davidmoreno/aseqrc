
export type PortId = string;

export interface PortI{
    input: boolean;
    output: boolean;
    label: string;
    id: string;
    port: PortId;
};
