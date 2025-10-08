import { Users } from "lucide-react";
import { PageTitle } from "../title-page/title-page";
import UserRegister from "./user-register";
import UserList from "./user-list";

export default function UserManager() {
    return (
        <div>
            <PageTitle title="User Manager" icon={Users} size="md" />

            <div className="p-5 grid gap-5">
                <UserRegister />
                <UserList />
            </div>
        </div>
    );
}
