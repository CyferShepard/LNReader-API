export class SourceFilterField {
  type: FilterType;
  isParameter: boolean;
  fieldName: string;
  fieldVar: string;
  isMultiVar: boolean;

  constructor({
    type,
    isParameter = true,
    fieldName,
    fieldVar,
    isMultiVar = false,
  }: {
    type: FilterType;
    isParameter?: boolean;
    fieldName: string;
    fieldVar: string;
    isMultiVar?: boolean;
  }) {
    this.type = type;
    this.isParameter = isParameter;
    this.fieldName = fieldName;
    this.fieldVar = fieldVar;
    this.isMultiVar = isMultiVar;
  }

  static fromJSON(data: any): SourceFilterField {
    return new SourceFilterField({
      type: FilterType.fromJSON(data.type),
      isParameter: data.isParameter,
      fieldName: data.fieldName,
      fieldVar: data.fieldVar,

      isMultiVar: data.isMultiVar || false,
    });
  }

  toJSON(): object {
    return {
      type: this.type.toJSON(),
      isParameter: this.isParameter,
      fieldName: this.fieldName,
      fieldVar: this.fieldVar,
      isMultiVar: this.isMultiVar,
    };
  }
}

export class FieldOptions {
  name: string;
  value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }

  static fromJSON(data: any): FieldOptions {
    return new FieldOptions(data.name, data.value);
  }

  static fromJsonList(dataList: any[]): FieldOptions[] {
    return dataList.map((data) => FieldOptions.fromJSON(data));
  }

  toJSON(): object {
    return {
      name: this.name,
      value: this.value,
    };
  }
}

export class FilterType {
  type: "main" | "text" | "numeric" | "dropdown" | "multiSelect" | "singleSelect" | "slider" | "toggle";
  fieldOptions: FieldOptions[];
  minValue?: number;
  maxValue?: number;
  defaultValue?: string | FieldOptions | number;

  constructor({
    type,
    fieldOptions = [],
    minValue,
    maxValue,
    defaultValue,
  }: {
    type: "main" | "text" | "numeric" | "dropdown" | "multiSelect" | "singleSelect" | "slider" | "toggle";
    fieldOptions?: FieldOptions[];
    minValue?: number;
    maxValue?: number;
    defaultValue?: string | FieldOptions | number;
  }) {
    this.type = type;
    this.fieldOptions = fieldOptions;
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.defaultValue = defaultValue;
  }

  static fromJSON(data: any): FilterType {
    return new FilterType({
      type: data.type,
      fieldOptions: FieldOptions.fromJsonList(data.fieldOptions || []),
      minValue: data.minValue,
      maxValue: data.maxValue,
      defaultValue: data.defaultValue,
    });
  }

  static Main(): FilterType {
    return new FilterType({
      type: "main",
    });
  }

  static Text(): FilterType {
    return new FilterType({
      type: "text",
    });
  }
  static Numeric(): FilterType {
    return new FilterType({
      type: "numeric",
    });
  }

  static Slider(minValue: number, maxValue: number, defaultValue?: number): FilterType {
    return new FilterType({
      type: "slider",
      minValue: minValue,
      maxValue: maxValue,
      defaultValue: defaultValue,
    });
  }

  static Dropdown(options: FieldOptions[], defaultValue?: FieldOptions): FilterType {
    return new FilterType({
      type: "dropdown",
      fieldOptions: options,
      defaultValue: defaultValue,
    });
  }

  static MultiSelect(options: FieldOptions[], defaultValue?: FieldOptions): FilterType {
    return new FilterType({
      type: "multiSelect",
      fieldOptions: options,
      defaultValue: defaultValue,
    });
  }

  static Toggle(defaultValue?: string): FilterType {
    return new FilterType({
      type: "toggle",
      defaultValue: defaultValue,
    });
  }

  static fromJsonList(dataList: any[]): FieldOptions[] {
    return dataList.map((data) => FieldOptions.fromJSON(data));
  }

  toJSON(): object {
    return {
      type: this.type,
      fieldOptions: this.fieldOptions.map((option) => option.toJSON()),
      minValue: this.minValue ?? null,
      maxValue: this.maxValue ?? null,
      defaultValue: this.defaultValue ?? null,
    };
  }
}
