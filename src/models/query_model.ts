export class QueryModel {
  select: string[];
  from: string;
  join: JoinModel[];
  where: string[];
  groupBy: string[];
  orderBy: string[];

  constructor(
    select: string[],
    from: string,
    join: JoinModel[] = [],
    where: string[] = [],
    groupBy: string[] = [],
    orderBy: string[] = [],
  ) {
    this.select = select;
    this.from = from;
    this.join = join;
    this.where = where;
    this.groupBy = groupBy;
    this.orderBy = orderBy;
  }

  get query(): string {
    const selectClause = `SELECT ${this.select.join(", ")}`;
    const fromClause = `FROM ${this.from}`;
    const joinClause = this.join.map((j) => `JOIN ${j.table} ON ${j.joinCondition}`).join(" ");
    const whereClause = this.where.length > 0 ? `WHERE ${this.where.join(" AND ")}` : "";
    const groupByClause = this.groupBy.length > 0 ? `GROUP BY ${this.groupBy.join(", ")}` : "";
    const orderByClause = this.orderBy.length > 0 ? `ORDER BY ${this.orderBy.join(", ")}` : "";
    return [selectClause, fromClause, joinClause, whereClause, groupByClause, orderByClause].filter((clause) => clause).join(" ");
  }

  get countQuery(): string {
    const fromClause = `FROM ${this.from}`;
    const joinClause = this.join.map((j) => `JOIN ${j.table} ON ${j.joinCondition}`).join(" ");
    const whereClause = this.where.length > 0 ? `WHERE ${this.where.join(" AND ")}` : "";
    return `SELECT COUNT(*) as COUNT ${fromClause} ${joinClause} ${whereClause}`;
  }
}

export class JoinModel {
  table: string;
  onAnd: JoinClauseModel[];
  onOr: JoinClauseModel[];

  constructor(table: string, onAnd: JoinClauseModel[], onOr: JoinClauseModel[] = []) {
    this.table = table;
    this.onAnd = onAnd;
    this.onOr = onOr;
  }

  get joinCondition(): string {
    const onAndClause = this.onAnd.map((c) => c.condition).join(" AND ");
    const onOrClause = this.onOr.map((c) => c.condition).join(" OR ");
    if (onAndClause && onOrClause) {
      return `(${onAndClause}) OR (${onOrClause})`;
    } else if (onAndClause) {
      return onAndClause;
    } else if (onOrClause) {
      return onOrClause;
    } else {
      return "";
    }
  }
}

export class JoinClauseModel {
  property: string;
  value: string;
  operator: string;

  constructor(property: string, value: string, operator: string) {
    this.property = property;
    this.value = value;
    this.operator = operator;
  }

  static equal(property: string, value: string): JoinClauseModel {
    return new JoinClauseModel(property, value, "=");
  }

  static notEqual(property: string, value: string): JoinClauseModel {
    return new JoinClauseModel(property, value, "!=");
  }

  static greaterThan(property: string, value: string): JoinClauseModel {
    return new JoinClauseModel(property, value, ">");
  }

  static lessThan(property: string, value: string): JoinClauseModel {
    return new JoinClauseModel(property, value, "<");
  }

  get condition(): string {
    return `${this.property} ${this.operator} ${this.value}`;
  }
}
