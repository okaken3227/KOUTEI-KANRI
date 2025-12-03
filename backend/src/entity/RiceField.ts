import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { User } from "./User";
import { WorkRecord } from "./WorkRecord";

@Entity()
export class RiceField {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  owner!: string;

  @Column("geometry", { spatialFeatureType: "Polygon", srid: 4326 })
  polygon!: string;

  @Column({ nullable: true })
  area!: number;

  @Column({ default: "未着手" })
  status!: string;

  @ManyToOne(() => User, (user) => user.fields)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column()
  userId!: number;

  @OneToMany(() => WorkRecord, (record) => record.field)
  records!: WorkRecord[];
}



