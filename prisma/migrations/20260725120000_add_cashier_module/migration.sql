-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CASHIER';

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_account_id_fkey";

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "complement" TEXT,
ALTER COLUMN "number" SET DATA TYPE TEXT,
ALTER COLUMN "zipcode" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "photo_url" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "active_for_in" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "active_for_out" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "system_configs" ADD COLUMN     "cashier_default_origin" TEXT NOT NULL DEFAULT 'Mesa',
ADD COLUMN     "cashier_module" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dashboard_cards" JSONB DEFAULT '{}',
ADD COLUMN     "financial_management_profile" TEXT NOT NULL DEFAULT 'ANALYTICAL';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "attachment_url" TEXT,
ADD COLUMN     "cashier_session_id" TEXT,
ADD COLUMN     "checked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "treatment_id" TEXT,
ALTER COLUMN "account_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "account_adjustments" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "previous_balance" DOUBLE PRECISION NOT NULL,
    "new_balance" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_modules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,

    CONSTRAINT "user_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_rule_histories" (
    "id" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "he_divisor" INTEGER NOT NULL DEFAULT 220,
    "he_multiplier_standard" DECIMAL(65,30) NOT NULL DEFAULT 1.6,
    "he_multiplier_special" DECIMAL(65,30) NOT NULL DEFAULT 2.0,
    "daily_workload_minutes" INTEGER NOT NULL DEFAULT 500,
    "tolerance_minutes" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_rule_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NATIONAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "treatment_id" TEXT,
    "cashier_session_id" TEXT,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT,
    "service_id" TEXT,
    "supply_id" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_print_departments" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "print_department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_print_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_identifiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payment_method_id" TEXT,
    "is_correntista_debt" BOOLEAN NOT NULL DEFAULT false,
    "is_stock_evasion" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_machines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_machine_rates" (
    "id" TEXT NOT NULL,
    "pos_machine_id" TEXT NOT NULL,
    "payment_category" TEXT NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "tax_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_machine_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_conditions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "period" TEXT NOT NULL DEFAULT 'Almoço',
    "initial_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashier_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_entries" (
    "id" TEXT NOT NULL,
    "cashier_session_id" TEXT NOT NULL,
    "origin" TEXT,
    "bank" TEXT,
    "payment_method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "is_withdrawal" BOOLEAN NOT NULL DEFAULT false,
    "is_addition" BOOLEAN NOT NULL DEFAULT false,
    "is_tip" BOOLEAN NOT NULL DEFAULT false,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'SALE',
    "identification" TEXT,
    "client_id" TEXT,
    "employee_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashier_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modules_slug_key" ON "modules"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_modules_user_id_module_id_key" ON "user_modules"("user_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "sales_treatment_id_key" ON "sales"("treatment_id");

-- CreateIndex
CREATE UNIQUE INDEX "print_departments_name_key" ON "print_departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_print_departments_product_id_print_department_id_key" ON "product_print_departments"("product_id", "print_department_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_identifiers_name_key" ON "payment_identifiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pos_machines_name_key" ON "pos_machines"("name");

-- CreateIndex
CREATE UNIQUE INDEX "payment_conditions_name_key" ON "payment_conditions"("name");

-- AddForeignKey
ALTER TABLE "account_adjustments" ADD CONSTRAINT "account_adjustments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "treatments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashier_session_id_fkey" FOREIGN KEY ("cashier_session_id") REFERENCES "cashier_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "treatments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_session_id_fkey" FOREIGN KEY ("cashier_session_id") REFERENCES "cashier_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_print_departments" ADD CONSTRAINT "product_print_departments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_print_departments" ADD CONSTRAINT "product_print_departments_print_department_id_fkey" FOREIGN KEY ("print_department_id") REFERENCES "print_departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_identifiers" ADD CONSTRAINT "payment_identifiers_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_machine_rates" ADD CONSTRAINT "pos_machine_rates_pos_machine_id_fkey" FOREIGN KEY ("pos_machine_id") REFERENCES "pos_machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_entries" ADD CONSTRAINT "cashier_entries_cashier_session_id_fkey" FOREIGN KEY ("cashier_session_id") REFERENCES "cashier_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_entries" ADD CONSTRAINT "cashier_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_entries" ADD CONSTRAINT "cashier_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

