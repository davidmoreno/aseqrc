import request from 'request-promise-native'

let BASE_URL = "http://localhost:5000"

export async function post<T=any>(url: string, qs: any){
    const options = {
        method: 'POST',
        body: qs,
        uri: `${BASE_URL}/${url}`,
        json: true,
    }

    return (await request(options)) as T
}

export async function get<T=any>(url: string, qs: any={}){
    const options = {
        method: 'GET',
        qs,
        uri: `${BASE_URL}/${url}`,
        json: true,
    }

    return (await request(options)) as T
}

export default {
    get,
    post,
}
