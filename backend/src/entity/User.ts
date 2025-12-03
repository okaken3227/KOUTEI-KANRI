import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { RiceField } from "./RiceField";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ nullable: true })
  email!: string;

  @OneToMany(() => RiceField, (field) => field.user)
  fields!: RiceField[];
}

