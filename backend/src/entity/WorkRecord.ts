import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { RiceField } from "./RiceField";

@Entity()
export class WorkRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  date!: Date;

  @Column()
  workType!: string;

  @Column()
  year!: number;

  @Column({ nullable: true })
  worker!: string;

  @Column({ nullable: true })
  weather!: string;

  @Column("float", { nullable: true })
  temperature!: number;

  @ManyToOne(() => RiceField, (field) => field.records, { onDelete: "CASCADE" })
  @JoinColumn({ name: "fieldId" })
  field!: RiceField;

  @Column()
  fieldId!: number;
}



