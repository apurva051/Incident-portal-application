pipeline {
    agent any

    options {
        // Jenkins ka automatic checkout disable kiya because
        // hum separate Checkout stage use kar rahe hain.
        skipDefaultCheckout(true)

        // Multiple deployments ko simultaneously run hone se rokta hai.
        disableConcurrentBuilds()
    }

    environment {
        AWS_REGION      = 'ap-south-1'
        AWS_ACCOUNT_ID  = '401780891012'
        ECR_REPOSITORY  = 'incident-portal'
        IMAGE_TAG       = "${BUILD_NUMBER}"
        ECR_REGISTRY    = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        KUBECONFIG      = '/var/lib/jenkins/.kube/config'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Image') {
            steps {
                sh '''
                    docker build \
                      -t ${ECR_REPOSITORY}:${IMAGE_TAG} .
                '''
            }
        }

        stage('ECR Login') {
            steps {
                sh '''
                    aws ecr get-login-password \
                      --region ${AWS_REGION} |
                    docker login \
                      --username AWS \
                      --password-stdin ${ECR_REGISTRY}
                '''
            }
        }

        stage('Push Image') {
            steps {
                sh '''
                    docker tag \
                      ${ECR_REPOSITORY}:${IMAGE_TAG} \
                      ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}

                    docker push \
                      ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}
                '''
            }
        }

        stage('Refresh ECR Secret') {
            steps {
                sh '''
                    # Prevent temporary ECR token from appearing in logs.
                    set +x

                    ECR_PASSWORD=$(aws ecr get-login-password \
                      --region ${AWS_REGION})

                    kubectl create secret docker-registry ecr-secret \
                      --docker-server=${ECR_REGISTRY} \
                      --docker-username=AWS \
                      --docker-password="${ECR_PASSWORD}" \
                      --dry-run=client \
                      -o yaml |
                    kubectl apply -f -

                    unset ECR_PASSWORD
                '''
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                sh '''
                    kubectl set image deployment/incident-portal \
                      incident-portal=${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}

                    kubectl rollout status deployment/incident-portal \
                      --timeout=120s
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    SERVICE_IP=$(kubectl get service incident-portal-service \
                      -o jsonpath='{.spec.clusterIP}')

                    echo "Testing application through Service IP: ${SERVICE_IP}"

                    curl --fail \
                      --retry 5 \
                      --retry-all-errors \
                      --retry-delay 5 \
                      http://${SERVICE_IP}:8000
                '''
            }
        }
    }

    post {
        success {
            echo "Build ${env.BUILD_NUMBER} successfully pushed and deployed!"
        }

        failure {
            echo 'CI/CD pipeline failed. Check the failed stage logs.'
        }

        always {
            sh '''
                docker rmi \
                  ${ECR_REPOSITORY}:${IMAGE_TAG} \
                  ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG} \
                  2>/dev/null || true

                docker image prune -f || true
            '''
        }
    }
}
