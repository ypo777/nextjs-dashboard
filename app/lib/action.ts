'use server';
import {z} from 'zod';
import {sql} from '@vercel/postgres'
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {signIn} from "@/auth";

const InvoiceSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error:'Please select a customer'
    }),
    amount: z.coerce.number().gt(0,{message:"Please enter an amount great than $0"}),
    status: z.enum(['pending','paid'],{invalid_type_error:'Please select an invoice status'}),
    date: z.string(),
})
const CreateInvoice = InvoiceSchema.omit({
    id:true,date:true
})
const UpdateInvoice = InvoiceSchema.omit({date:true})

export type State = {
    errors?:{
        customerId?:string[];
        amount?:string[];
        status?:string[];
    };
    message?:string | null;
}

export async function createInvoice(prevState:State,formData:FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId:formData.get('customerId'),
        amount:formData.get('amount'),
        status:formData.get('status'),
    });
    if(!validatedFields.success){
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice',
        };
    }
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    // Insert data into the database
    try {
        await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    } catch (error) {
        // If a database error occurs, return a more specific error.
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }

    // Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');

    // const rawFormData = {
    //     customerId: formData.get('customerId'),
    //     amount: formData.get('amount'),
    //     status: formData.get('status'),
    // };
    // console.log(typeof rawFormData.amount)
}

export async function updateInvoice(formData:FormData){
    const {id,customerId,amount,status} = UpdateInvoice.parse({
        id: formData.get('id'),
        customerId:formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })
    const amountInCents = amount * 100;

    try{
    await sql`
            UPDATE invoices
            SET customer_id = ${customerId},amount=${amountInCents}, status=${status}
            WHERE id=${id}`
        revalidatePath('/dashboard/invoices')
        redirect('/dashboard/invoices')
    }catch (error){
        return{
            message: "Error to Update "
        }
    }

}
export async function deleteInvoice(formData:FormData){
    const id = formData.get('id')?.toString();
    try {
        await sql`
            DELETE FROM invoices WHERE id=${id}`;
        revalidatePath('/dashboard/invoices')
        redirect('/dashboard/invoices')
    }catch (error){
        return {
            message:"Error to Delete"
        }
    }

}


// ...

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', Object.fromEntries(formData));
    } catch (error) {
        if ((error as Error).message.includes('CredentialsSignin')) {
            return 'CredentialSignin';
        }
        throw error;
    }
}