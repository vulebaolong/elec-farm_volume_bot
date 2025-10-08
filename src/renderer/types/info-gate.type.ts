export type TInfoGate = {
    uid: number;
    nickname: string;
    regtime: string;
    verified: number;
    country: number;
    is_sub: number;
    sub_status: number;
    main_uid: number;
    sub_remark: string;
    sub_website_id: number;
    type: number;
    tier: number;
    tier_timest: string;
    flag: number;
    email: string;
    phone: string;
    timest: string;
    sub_type: number;
    fundpass: boolean;
    anonymous: string;
    login2: number;
    nickname_source: string;
    user_info: UserInfo;
    kyc_status: number;
    encrypted_uid: string;
    third_part_login: ThirdPartLogin[];
    customer_manger_info: CustomerMangerInfo;
};

export interface UserInfo {
    uid: number;
    nick: string;
    avatar: string;
    nick_en: string;
    nft_id: number;
    birthday: string;
    sex: string;
    from_channel: string;
    tier_plan: number;
}

export interface ThirdPartLogin {
    name: string;
    type: string;
    logo_light: string;
    logo_dark: string;
}

export interface CustomerMangerInfo {
    has_customer_manger: number;
    name: string;
    telegram_link: string;
    avatar: string;
}
